"""Utility functions for interacting with datastore."""


def mod_query(client):
    return client.query(kind='Module')


def get_mod_keys(client):
    """Retrieve all mod datastore keys."""
    query = mod_query(client)
    query.keys_only()
    return list(query.fetch())


def get_muted_mods(client):
    """Retrieve only muted datastore keys."""
    query = mod_query(client)
    query.keys_only()
    query.add_filter('mute', '=', True)
    return list(query.fetch())


def get_entity_by_key(client, key):
    return client.get(key)


def get_mods_by_param(client, param, value):
    query = mod_query(client)
    query.add_filter(param, '=', value)
    return list(query.fetch())
