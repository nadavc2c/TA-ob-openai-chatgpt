<div style="text-align: center;">
  <a href="https://github.com/nadavc2c/TA-ob-openai-chatgpt">
    <img src="https://raw.githubusercontent.com/nadavc2c/TA-ob-openai-chatgpt/main/static/logo2.png" alt="Logo" width=72 height=72>
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

## Status

Pending for approval in Splunkbase.

## What's included

Please refer to `TA-ob-openai-chatgpt/default/searchbnf.conf` for options and syntax.

Add your new modes to `bin\modes.json`

Guides with screenshots and videos will be released soon.

## Bugs and feature requests

Have a bug or a feature request? Please first search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/nadavc2c/TA-ob-openai-chatgpt/issues).

## Contributing

Please read through our [contributing guidelines](https://www.azquotes.com/quote/1596230). 

## Creators

**Nadav Gaming Cohen**

- <https://github.com/nadavc2c>

## Thanks

You should thank Outbrain™️ that graced this add-on upon you.

## Copyright and license

Code and documentation copyright 2024 the authors. Code released under the [MIT License](https://github.com/nadavc2c/TA-ob-openai-chatgpt/blob/main/LICENSE).\
Copyrights for included packaged might be different.

Enjoy :metal: