#!/usr/bin/env python
import json
import sys
import os
import itertools
from time import sleep
from configparser import ConfigParser
import xml.etree.ElementTree as ElementTree
from re import sub
from urllib.parse import urlparse
from hashlib import sha256

# import after PATH update on purpose
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from splunklib.searchcommands import dispatch, StreamingCommand, Configuration, Option
import openai
from openai import OpenAI

app_folder = os.path.basename(os.path.dirname(os.path.dirname(__file__)))
custom_conf_file = sub(r'\W+', '_', app_folder.lower() + "_settings")


@Configuration()
class ObopenaiCommand(StreamingCommand):
    """ Send prompts to ChatGPT

    ##Syntax

    obopenai prompt=<string> (mode=(dlp))? (model=(gpt-35-turbo))? (temperature=(number))?

    ##Description

    Send prompts to the local OpenAI proxy of OB

    """

    # available modes: dlp,
    mode = Option()
    prompt = Option(require=True)
    conversation = Option()
    model = Option()
    temperature = Option()
    maxrows = Option()
    maxtokens = Option()
    system_role = Option()
    sleep_time = Option()
    setuser = Option()

    # response_field = Option() "I'm not going to write those 10 lines of code until necessary or someone will pay me"
    # session_key = Option() "imagine doing the logical thing and not sending the entire chat history everytime"

    def _set_chat_role(self):
        with open('modes.json', 'r') as file:
            json_modes = json.load(file)

        if self.mode:
            if self.system_role:
                raise ValueError("You can only choose one of 'mode' or 'system_role', not both.")
            try:
                chat_system_role = json_modes[self.mode]
            except KeyError:
                # find your mode in the kvstore
                modes_kvstore = self.service.kvstore['TA_ob_openai_chatgpt_system_modes'].data.query()
                for item in modes_kvstore:
                    if item['mode_name'] == self.mode:
                        chat_system_role = item['system_prompt']
                        break
                else:
                    chat_system_role = "you are an Indian cook that knows only how to cook and" \
                                       " nothing else. you will not " \
                                       "answer anything that is not related to cooking. act as an Indian cook."
        elif self.system_role:
            chat_system_role = self.system_role
        else:
            chat_system_role = None
        return chat_system_role

    def _set_conf_settings(self):
        # get collection
        api_base_value = None
        obopenai_settings_conf = self.service.confs[custom_conf_file]["additional_parameters"]

        try:
            if obopenai_settings_conf["api_base"]:
                url_parse = urlparse(obopenai_settings_conf["api_base"])
                if url_parse.scheme == "https":
                    api_base_value = obopenai_settings_conf["api_base"]
                elif url_parse.scheme == '':
                    url_partition = obopenai_settings_conf["api_base"].partition("//")
                    if sha256(url_partition[0].encode()).hexdigest() == \
                            '197946480c751003199f56c25fa6ef2117f4f34f49e1b63f82bfba74934fcc27':
                        api_base_value = url_partition[2]
                    else:
                        raise ValueError("Error: URL must start with https://")
                else:
                    raise ValueError("Error: URL must start with https://")
        except AttributeError or KeyError:
            pass

        return api_base_value, obopenai_settings_conf["organization_id"]

    def _get_decrypted_password(self):
        password_xml = self.service.storage_passwords.get(app=app_folder)['body']

        for element in ElementTree.fromstring(str(password_xml)).findall(".//*[@name='clear_password']"):
            try:
                api_dict = json.loads(element.text)
                if 'api_key' in api_dict:
                    clear_text_password = api_dict['api_key']
                    break
            except json.JSONDecodeError:
                pass
        else:
            raise ValueError("No password was found")
        return clear_text_password

    # override
    def stream(self, events):
        # From .conf

        api_base, org_id = self._set_conf_settings()

        client = OpenAI(api_key=self._get_decrypted_password(), base_url=api_base, organization=org_id)

        # From arguments
        model = self.model or "gpt-3.5-turbo"
        # maxrows is per batch of 50,000. set to 10 to not violate license by mistake. 0 to limitless.
        maxrows = self.maxrows or 5  # walrus only in 3.8
        maxrows = None if int(maxrows) == 0 else int(maxrows)
        maxtokens = int(self.maxtokens) if self.maxtokens else None
        temperature = float(self.temperature) if self.temperature else None
        system_role = self._set_chat_role()
        sleep_time = int(self.sleep_time) if self.sleep_time else 0
        user = self.setuser or self.service.confs[custom_conf_file]["additional_parameters"]['default_user']
        # organization = self.service.confs[custom_conf_file]["additional_parameters"]['organization_id']

        for event in itertools.islice(events, maxrows):
            messages = []
            if self.mode == 'conv':
                messages.append(json.loads(event[self.conversation]))
            elif system_role:
                messages.append({"role": "system", "content": system_role})
            messages.append({"role": "user", "content": event[self.prompt]})
            print(type(event[self.prompt]))
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                user=user,
                max_tokens=maxtokens
            )
            self.add_field(event, 'gpt_response', response)
            if self.mode == 'conv':
                messages.append(response.choices[0].message)
                self.add_field(event, self.conversation, messages)
            sleep(sleep_time) if sleep_time else None
            yield event


dispatch(ObopenaiCommand, sys.argv, sys.stdin, sys.stdout, __name__)
