import React, { Component } from "react";
import _ from "lodash";
import $ from "jquery";
import Styles from "./AccordionGroup.pcssm";
import classnames from "classnames";
import { makeHelpUrl } from "app/utils/HelpLinkUtil";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class AccordionGroup extends Component {
    static defaultProps = {
        isCollapsible: true,
        defaultOpen: false,
        title: ""
    };

    static propTypes = {
        children: PropTypes.any,
        title: PropTypes.string,
        description: PropTypes.string,
        helpLinkKey: PropTypes.string,
        isCollapsible: PropTypes.bool,
        defaultOpen: PropTypes.bool
    };

    constructor(...args) {
        super(...args);
        this.state = { isOpen: this.props.defaultOpen };
    }
    render() {
        const {
            children,
            title,
            description,
            helpLinkKey,
            isCollapsible
        } = this.props;
        const isOpen = this.state.isOpen || !isCollapsible;
        return (
            <div
                className={ Styles.root }
                ref="node"
                { ...createTestHook(__filename) }
            >
                <div
                    className={
                        isCollapsible ? Styles.head : Styles.headNoInteraction
                    }
                    onClick={ this.onAccordionClick }
                    { ...createTestHook(null, {
                        componentName: "ta-component-accordion-header"
                    }) }
                >
                    <a className={ Styles.toggle } data-toogle="collapse">
                        {isCollapsible
                            ? <i
                                  className={ classnames(
                                      Styles.toggleIcon,
                                      isOpen
                                          ? "icon-chevron-down"
                                          : "icon-chevron-right"
                                  ) }
                                  ref="icon"
                              />
                            : null}
                        {title}
                    </a>
                </div>
                <div
                    className={ classnames(Styles.inner, "clearfix") }
                    ref="inner"
                    style={ isOpen ? {} : { display: "none" } }
                >
                    {description
                        ? <div className={ Styles.description }>
                              <span
                                  dangerouslySetInnerHTML={ {
                                      __html: description + " "
                                  } }
                              />
                              {helpLinkKey
                                  ? <a
                                        className="external"
                                        target="_blank"
                                        href={ makeHelpUrl(helpLinkKey) }
                                    >
                                        {_.t("Learn more")}
                                    </a>
                                  : null}
                          </div>
                        : null}
                    {children}
                </div>
            </div>
        );
    }
    onAccordionClick() {
        this.setState({ isOpen: this.state.isOpen });
        const { isCollapsible } = this.props;
        if (!isCollapsible) {
            return;
        }
        $(this.refs.icon)
            .toggleClass("icon-chevron-right")
            .toggleClass("icon-chevron-down");
        $(this.refs.node).toggleClass("active");
        $(this.refs.inner).slideToggle(200);
    }
}
