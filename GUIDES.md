<div style="text-align: center;">
  <a href="https://github.com/nadavc2c/TA-ob-openai-chatgpt">
    <img src="https://raw.githubusercontent.com/nadavc2c/TA-ob-openai-chatgpt/main/static/logo2.png" alt="Logo" width=72 height=72>
  </a>

  <h3 align="center">OB OpenAI</h3>

  <div style="text-align: center;">
    Enrich your logs with the power of AI
    <br>
    <a href="https://quotefancy.com/quote/1439790/Fran-Tarkenton-If-it-s-not-fun-you-are-not-doing-it-right">Report bug</a>
    ·
    <a href="https://github.com/nadavc2c/TA-ob-openai-chatgpt/issues">Request feature</a>
  </div>
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

```text
folder1/
└── folder2/
    ├── folder3/
    │   ├── file1
    │   └── file2
    └── folder4/
        ├── file3
        └── file4
```

## Bugs and feature requests

Have a bug or a feature request? Please first read the [issue guidelines](https://reponame/blob/master/CONTRIBUTING.md) and search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://reponame/issues/new).

## Contributing

Please read through our [contributing guidelines](https://reponame/blob/master/CONTRIBUTING.md). Included are directions for opening issues, coding standards, and notes on development.

Moreover, all HTML and CSS should conform to the [Code Guide](https://github.com/mdo/code-guide), maintained by [Main author](https://github.com/usernamemainauthor).

Editor preferences are available in the [editor config](https://reponame/blob/master/.editorconfig) for easy use in common text editors. Read more and download plugins at <https://editorconfig.org/>.

## Creators

**Creator 1**

- <https://github.com/usernamecreator1>

## Thanks

Some Text

## Copyright and license

Code and documentation copyright 2011-2018 the authors. Code released under the [MIT License](https://reponame/blob/master/LICENSE).

Enjoy :metal: