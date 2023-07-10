import _ from "lodash";
import React from "react";
import PropTypes from "prop-types";
import Backbone from "backbone";
import { SearchBarView } from "swc-aob/index";
import { SearchBNFs } from "swc-aob/index";
import { getCurrentApp } from "app/utils/AppInfo";

export default class SearchBar extends React.Component {
    static defaultProps = {
        value: "",
        disabled: false,
        onChange: _.noop,
        onSubmit: _.noop
    };
    static propTypes = {
        value: PropTypes.string,
        disabled: PropTypes.bool,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func
    };
    constructor(...args) {
        super(...args);
        this._search = new Backbone.Model({
            search: ""
        });
        this._content = new Backbone.Model({
            search: ""
        });
    }
    componentDidMount() {
        this.renderView();
    }
    componentWillUnmount() {
        this.removeView();
    }
    componentDidUpdate() {
        this.renderView();
    }
    renderView() {
        const { value, onChange, onSubmit, disabled } = this.props;
        if (!this._view) {
            const searchBNFs = new SearchBNFs();
            searchBNFs.fetch({
                data: {
                    app: getCurrentApp(),
                    owner: "nobody",
                    count: 0
                },
                parseSyntax: true,
                options: {
                    async: false
                }
            });
            this._view = new SearchBarView({
                model: {
                    searchBar: this._search,
                    content: this._content,
                    application: new Backbone.Model()
                },
                collection: {
                    searchBNFs: searchBNFs
                },
                searchAttribute: "search",
                showTimeRangePicker: false,
                useSyntaxHighlighting: true,
                showLineNumbers: false,
                searchAssistant: "compact",
                submitEmptyString: false
            });
            this._view.render().appendTo(this.refs.wrapper);
            this._search.on("change:search", event => {
                if (this.props.value !== this._search.get("search")) {
                    onChange(event, { value: this._search.get("search") });
                }
            });
            this._content.on("change:search", event => {
                onSubmit(event, { value: this._content.get("search") });
            });
        }
        this._view.setText(value);
        if (disabled) {
            this._view.disable();
        } else {
            this._view.enable();
        }
    }
    removeView() {
        if (this._view && _.isFunction(this._view.remove)) {
            this._view.remove();
            this._search.off("change");
            this._content.off("change");
        }
    }
    render() {
        return <div ref="wrapper" style={ { width: "100%" } } />;
    }
}
