import $ from "jquery";
import _ from "lodash";
import React from "react";
import Styles from "./SearchEventsView.pcssm";
import { SplunkEventsView } from "swc-aob/index";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class SearchEventsView extends React.Component {
    static defaultProps = {
        searchID: ""
    };

    static propTypes = {
        searchID: PropTypes.string
    };
    constructor(...args) {
        super(...args);
        this.view = null;
    }
    componentDidMount() {
        this.updateEventsView();
    }
    componentDidUpdate() {
        this.updateEventsView();
    }
    componentWillUnmount() {
        this.removeEventsView();
    }
    updateEventsView() {
        const { searchID } = this.props;
        if (this.view && this.view.settings.get("managerid") === searchID) {
            return;
        }
        this.removeEventsView();
        $(this.refs.view).empty();

        if (!searchID) {
            return;
        }
        this.view = new SplunkEventsView({
            id: `${searchID}_view`,
            managerid: searchID,
            type: "list",
            "table.drilldown": true, // Place complex property names within quotes
            drilldownRedirect: false,
            "table.sortColumn": "sourcetype",
            "table.sortDirection": "asc",
            "table.wrap": true,
            count: 10
        });
        $(this.refs.view).append(this.view.render().$el);
    }
    removeEventsView() {
        if (this.view && _.isFunction(this.view.destroy)) {
            this.view.destroy();
        }
    }
    render() {
        return (
            <div
                className={ Styles.root }
                ref="view"
                { ...createTestHook(__filename) }
            />
        );
    }
}
