import React from "react";
import _ from "lodash";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import Styles from "./HelpLinkHeader.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class HelpLinkHeader extends React.Component {
    static propTypes = {
        helpLinkKey: PropTypes.string,
        description: PropTypes.string,
        title: PropTypes.string,
        url: PropTypes.string
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        let { helpLinkKey, description, title, url } = this.props;
        if (helpLinkKey != null) {
            ({ description, url } = getHelpLinkObj(helpLinkKey));
        }
        let rootClassName = Styles.root;
        if (!description && !url) {
            rootClassName = Styles.rootWithoutDescription;
        }
        return (
            <div className={ rootClassName } { ...createTestHook(__filename) }>
                <div className={ Styles.title }>
                    {title}
                </div>
                <div className={ Styles.description }>
                    <span
                        // The reason why use dangerouslySetInnerHTML here is because description may contain html tags and styles.
                        dangerouslySetInnerHTML={ { __html: description + " " } }
                    />
                    { url &&
                    <a className="external" target="_blank" href={ url }>
                        {_.t("Learn more")}
                    </a>
                    }
                </div>
            </div>
        );
    }
}
