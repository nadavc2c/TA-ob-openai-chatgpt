# encoding = utf-8

GLOBAL_PASSWORD_CONF = 'passwords.conf'

def get_app_namespace(app_name):
    '''
    the namespace is used as the rest root prefix
    '''
    if not app_name:
        raise ValueError('app name is empty.')
    return app_name.strip().replace('-', '_')

def get_global_account_conf_file_name(app_name):
    # the prefix is the restRoot
    return '{}_account.conf'.format(get_app_namespace(app_name).lower())

def get_global_settings_conf_file_name(app_name):
    # the prefix is the restRoot
    return '{}_settings.conf'.format(get_app_namespace(app_name).lower())

def get_ucc_conf_file_names(app_name):
    files = []
    files.append(get_global_account_conf_file_name(app_name))
    files.append(get_global_settings_conf_file_name(app_name))
    files.append(GLOBAL_PASSWORD_CONF)
    return files
