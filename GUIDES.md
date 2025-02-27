<div style="text-align: center;">
  <a href="https://github.com/nadavc2c/TA-ob-openai-chatgpt">
    <img src="https://raw.githubusercontent.com/nadavc2c/TA-ob-openai-chatgpt/main/static/logo.png" alt="Logo" width=72 height=72>
  </a>
  <h3>OB OpenAI</h3>
Enrich your logs with the power of AI
<br>
<a href="https://quotefancy.com/quote/1439790/Fran-Tarkenton-If-it-s-not-fun-you-are-not-doing-it-right">Report bug</a>
·
<a href="https://github.com/nadavc2c/TA-ob-openai-chatgpt/issues">Request feature</a>
</div>

## Table of contents

- [Quick start](#quick-start)
- [Status](#status)
- [What's included](#whats-included)
- [Bugs and feature requests](#bugs-and-feature-requests)
- [Contributing](#contributing)
- [Creators](#creators)
- [Thanks](#thanks)
- [Copyright and license](#copyright-and-license)

## Quick start

Hello there! This add-on is graced upon you by Outbrain™️, the leading Native Ads platform.

- Create a field with some prompt
- Pipe to to `| obopenai prompt=field_name`
- Extract the response with `| spath input=gpt_response output=response_content path="choices{0}.message.content"`
- [Quickstart tutorial on Youtube](https://youtu.be/8TQTXkoHObk)

## Status

Pending for approval in Splunkbase.\
If needed, please `chmod -R 644 .` to set the correct permissions after extracting the package.\
Default permissions are [restrictive](https://github.com/nadavc2c/TA-ob-openai-chatgpt/blob/bc76c6320bff7cf140bd8b87cd4811589d883d29/TA-ob-openai-chatgpt/metadata/default.meta) (admin role only), but you can change it to allow other users to use this add-on.

## What's included

Please refer to `TA-ob-openai-chatgpt/default/searchbnf.conf` for options and syntax.

Add your new modes to `bin\modes.json` or to the KV Store `TA_ob_openai_chatgpt_system_modes`.

Video guide is available.

## Bugs and feature requests

Have a bug or a feature request? Please first search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/nadavc2c/TA-ob-openai-chatgpt/issues).

## Contributing

Please read through our [contributing guidelines](https://www.azquotes.com/quote/1596230).\
If you need to send requests to HTTP for some reason, read the hidden comment below.
<!-- add before your full url the string 'OB_TEST_TOKEN_NADAV//' -->

## Creators

**Nadav Gaming Cohen**

- <https://github.com/nadavc2c>

## Thanks

You should thank Outbrain™️ that graced this add-on upon you.

## Copyright and license

Code and documentation copyright 2024 the authors. Code released under the [MIT License](https://github.com/nadavc2c/TA-ob-openai-chatgpt/blob/main/LICENSE).\
Copyrights for included packaged might be different.

Enjoy :metal:
