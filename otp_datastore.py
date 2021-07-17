import datetime
import jinja2
import logging
import random
import flask
from flask import Flask, jsonify, request
from flask.templating import render_template
from pathlib import Path

import ds_utils
import firebase_admin
from firebase_admin import auth, exceptions
from google.cloud import datastore
from google.cloud import logging as glogging


JINJA_OPTIONS = {
    'loader': jinja2.FileSystemLoader('templates'),
    'autoescape': True,
    'block_start_string': '<%',
    'block_end_string': '%>',
    'variable_start_string': '%%',
    'variable_end_string': '%%',
    'comment_start_string': '<#',
    'comment_end_string': '#>'
    }
TEMPLATE = 'index.html'
# Flask setup
app = Flask(__name__)
app.jinja_options = JINJA_OPTIONS
firebase_app = firebase_admin.initialize_app()

# GCP setup
client = datastore.Client()
curated_partial_keys = None
log_client = glogging.Client()
log_client.get_default_handler()
log_client.setup_logging()


@app.route('/get/mod')
def get_mod():
    """Handler for single-module get requests."""
    global curated_partial_keys

    mute_id = request.args.get('mute')
    if mute_id:
        set_mute(mute_id)

    muted_keys = ds_utils.get_muted_mods(client)
    muted_partial_keys = build_partial_key_set(muted_keys)

    if curated_partial_keys is None:
        all_mod_keys = ds_utils.get_mod_keys(client)
        all_partial_keys = build_partial_key_set(all_mod_keys)
        curated_partial_keys = list(all_partial_keys - muted_partial_keys)

    rkey = request.args.get('key')
    tmaid = request.args.get('id')
    filename = request.args.get('filename')

    if rkey:
        k = client.key('Module', int(rkey))
        mod = ds_utils.get_entity_by_key(client, k)
    elif tmaid:
        mod = get_mod_by_tmaid(tmaid)
    elif filename:
        mod = get_mod_by_filename(filename)
    else:
        mod = get_random_mod()
    return mod


def build_partial_key_set(entity_list):
    return set([e.key.id_or_name for e in entity_list])


def get_random_mod():
    global curated_partial_keys
    random.shuffle(curated_partial_keys)
    index = random.randint(0, len(curated_partial_keys) - 1)
    k = client.key('Module', int(curated_partial_keys[index]))
    return ds_utils.get_entity_by_key(client, k)


def get_mod_by_tmaid(tmaid):
    return ds_utils.get_mods_by_param(client, 'tmaid', tmaid)[0]


def get_mod_by_filename(filename):
    return ds_utils.get_mods_by_param(client, 'filename', filename)[0]


def set_mute(mod_id):
    logging.info('Muting mod id: %s', mod_id)
    query = ds_utils.mod_query(client)
    query.add_filter('tmaid', '=', mod_id)
    mod = list(query.fetch())[0]
    mod['mute'] = True
    client.put(mod)


@app.route('/get/playlist')
def get_playlist():
    """Handler for playlist get requests."""
    handle = request.args.get('handle')
    if not handle:
        return {'error': 'No handle provided.'}

    shuffled_mods = get_shuffled_mods_by_handle(handle)
    if not shuffled_mods:
        return {'error': f'No results for handle: {handle}'}

    shuffled_key_ids = [m.key.id_or_name for m in shuffled_mods]
    return {'keys': shuffled_key_ids}



def get_shuffled_mods_by_handle(handle):
    artist_mods = ds_utils.get_mods_by_param(client, 'artisthandle', handle)
    random.shuffle(artist_mods)
    return artist_mods


@app.route('/sessionLogin', methods=['POST'])
def session_login():
    id_token = request.form.get('idToken')
    
    expiry = datetime.timedelta(days=14)
    try:
        # Create the session cookie. This will also verify the ID token in the
        # process. The session cookie will have the same claims as the ID token.
        session_cookie = auth.create_session_cookie(id_token, expires_in=expiry)
        response = jsonify({'status': 'success'})
        # Set cookie policy for session cookie.
        expires = datetime.datetime.now() + expiry
        response.set_cookie(
            'session', session_cookie, expires=expires, httponly=True,
            secure=True)
        return response
    except exceptions.FirebaseError:
        return flask.abort(401, 'Failed to create a session cookie')


@app.route('/sessionLogout', methods=['POST'])
def session_logout():
    response = flask.make_response(flask.redirect('/'))
    response.set_cookie('session', expires=0)
    return response


@app.route('/')
def get_home():
    """Handler for initial content loading."""
    logging.info("CWD: %s" % Path.cwd())
    logging.info("Does ./templates exist? %s" % (
        Path.cwd() / 'templates').exists())
    logging.info("Does index.html exist? %s" % (
        Path.cwd() / 'templates' / 'index.html').exists())
    # Add Firebase Auth
    session_cookie = request.cookies.get('session')
    claims = {}
    # Login is optional, so don't force it if cookie is missing or expired.
    if session_cookie:
        try:
            claims = auth.verify_session_cookie(session_cookie)
        except auth.InvalidSessionCookieError:
            pass

    template_values = {
        'is_admin': claims.get('admin', False),
    }
    
    return render_template(TEMPLATE, **template_values)
