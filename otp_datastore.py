import jinja2
import json
import logging
import os
import random
import webapp2

import ds_utils
from google.appengine.api import users
from google.cloud import datastore
from requests_toolbelt.adapters import appengine


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True,
    block_start_string='<%',
    block_end_string='%>',
    variable_start_string='%%',
    variable_end_string='%%',
    comment_start_string='<#',
    comment_end_string='#>')

# Needed to force requests to work well on AppEngine
appengine.monkeypatch()
project = 'opentracker-player'
client = datastore.Client(project=project)
curated_partial_keys = None


class GetSingleModule(webapp2.RequestHandler):

    def get(self):
        """Handler for single-module get requests."""
        global curated_partial_keys

        mute_id = self.request.get('mute')
        if mute_id:
            self.set_mute(mute_id)

        muted_keys = ds_utils.get_muted_mods(client)
        muted_partial_keys = self.build_partial_key_set(muted_keys)

        if curated_partial_keys is None:
            all_mod_keys = ds_utils.get_mod_keys(client)
            all_partial_keys = self.build_partial_key_set(all_mod_keys)
            curated_partial_keys = list(all_partial_keys - muted_partial_keys)

        rkey = self.request.get('key')
        tmaid = self.request.get('id')
        filename = self.request.get('filename')

        if rkey:
            k = client.key('Module', int(rkey))
            mod = ds_utils.get_entity_by_key(client, k)
        elif tmaid:
            mod = self.get_mod_by_tmaid(tmaid)
        elif filename:
            mod = self.get_mod_by_filename(filename)
        else:
            mod = self.get_random_mod()
        self.response.write(json.dumps(mod))

    @staticmethod
    def build_partial_key_set(entity_list):
        return set([e.key.id_or_name for e in entity_list])

    @staticmethod
    def get_random_mod():
        global curated_partial_keys
        random.shuffle(curated_partial_keys)
        index = random.randint(0, len(curated_partial_keys) - 1)
        k = client.key('Module', int(curated_partial_keys[index]))
        return ds_utils.get_entity_by_key(client, k)

    @staticmethod
    def get_mod_by_tmaid(tmaid):
        return ds_utils.get_mods_by_param(client, 'tmaid', tmaid)[0]

    @staticmethod
    def get_mod_by_filename(filename):
        return ds_utils.get_mods_by_param(client, 'filename', filename)[0]

    @staticmethod
    def set_mute(mod_id):
        logging.info('Muting mod id: %s', mod_id)
        query = ds_utils.mod_query(client)
        query.add_filter('tmaid', '=', mod_id)
        mod = list(query.fetch())[0]
        mod['mute'] = True
        client.put(mod)


class GetPlaylist(webapp2.RequestHandler):

    def get(self):
        """Handler for playlist get requests."""
        handle = self.request.get('handle')
        if not handle:
            self.response.write(json.dumps({'error': 'No handle provided.'}))
            return
        shuffled_mods = self.get_shuffled_mods_by_handle(handle)
        if not shuffled_mods:
            self.response.write(json.dumps(
                {'error': 'No results for handle: %s' % handle}))
            return
        shuffled_key_ids = [m.key.id_or_name for m in shuffled_mods]
        response = {'keys': shuffled_key_ids}
        self.response.write(json.dumps(response))

    @staticmethod
    def get_shuffled_mods_by_handle(handle):
        artist_mods = ds_utils.get_mods_by_param(client, 'artisthandle', handle)
        random.shuffle(artist_mods)
        return artist_mods


class MainPage(webapp2.RequestHandler):

    def get(self):
        """Handler for initial content loading."""
        user = users.get_current_user()
        if user:
            url = users.create_logout_url(self.request.uri)
            url_linktext = 'Sign out'
        else:
            url = users.create_login_url(self.request.uri)
            url_linktext = 'Sign in'

        template_values = {
            'is_admin': users.IsCurrentUserAdmin(),
            'user': user,
            'url': url,
            'url_linktext': url_linktext,
        }

        template = JINJA_ENVIRONMENT.get_template('index.html')
        self.response.write(template.render(template_values))


app = webapp2.WSGIApplication([
    ('/get/mod', GetSingleModule),
    ('/get/playlist', GetPlaylist),
    ('/', MainPage),
])