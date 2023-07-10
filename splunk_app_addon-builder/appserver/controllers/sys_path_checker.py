import sys
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

bin_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin'])
validation_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin', 'validation_rules'])
controller_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'appserver', 'controllers'])
res_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin', 'splunk_app_add_on_builder'])
for path in (bin_path, validation_path, controller_path, res_path):
    if path not in sys.path:
        sys.path.insert(1, path)