# Version 4.1.3
#
# This file contains the possible attributes and values you can use to configure
# the Splunk Add-on Builder.
#
# There is a settings.conf in $SPLUNK_HOME/etc/apps/splunk_app_addon-builder/default/.  To set custom
# configurations, place a settings.conf in $SPLUNK_HOME/etc/apps/splunk_app_addon-builder/local/.
#
# To learn more about configuration files (including precedence), see:
# http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles

[app_cert]
auth_endpoint = <url>
# url to get the authentication token for app pre-certification service

server = <url>
# the url of app pre-certification service

proxy_enabled = <boolean>
# is proxy enabled for app pre-certification service

username = <string>
password = <string>
# user credential of app pre-certification service

timeout = <integer>
# timeout for App Certification validation, in seconds

interval = <integer>
proxy_host = <string>
proxy_port = <integer>
proxy_type = [HTTP | HTTPS]
proxy_username = <string>
proxy_password = <password>
# proxy setting for app pre-certification service

[perf_profile]
profiler_white_list = <string>
profiler_black_list = <string>
# comma separated strings, or null
# these two settings are used to control the performance log in add-on builder
