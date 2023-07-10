import React from "react";
import _ from "lodash";
import StylesDefault from "./BreadCrumb.pcssm";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const BreadCrumb = ({
    previousTitle,
    title,
    onPreviousTitleClick,
    children,
    helpLinkKey,
    description,
    url,
    StyleOverwrite
}) => {
    const Styles = _.assign({}, StylesDefault, StyleOverwrite);

    if (helpLinkKey != null) {
        ({ description, url } = getHelpLinkObj(helpLinkKey));
    }
    let hasDescription = description || url;

    return (
        <div className={ Styles.root } { ...createTestHook(__filename) }>
            <div
                className={
                    hasDescription
                        ? Styles.breadCrumbHeadWithDescription
                        : Styles.breadCrumbHead
                }
            >
                <div className={ Styles.breadCrumbHeadTitle }>
                    {previousTitle
                        ? <span>
                              <a
                                  className={ Styles.previousTitle }
                                  onClick={ event => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      onPreviousTitleClick();
                                  } }
                                  { ...createTestHook(null, {
                                      componentName: "ta-link-return"
                                  }) }
                              >
                                  {previousTitle}
                              </a>
                              <span className={ Styles.connector }>{" >> "}</span>
                          </span>
                        : null}
                    <span className={ Styles.title }>{title}</span>
                </div>
                {hasDescription
                    ? <div className={ Styles.breadCrumbHeadDescription }>
                          <span
                              // The reason why use dangerouslySetInnerHTML here is because description may contain html tags and styles.
                              dangerouslySetInnerHTML={ {
                                  __html: description + " "
                              } }
                          />
                          <a className="external" target="_blank" href={ url }>
                              {_.t("Learn more")}
                          </a>
                      </div>
                    : null}
            </div>
            <div
                className={
                    hasDescription
                        ? Styles.breadCrumbBodyWithDescription
                        : Styles.breadCrumbBody
                }
            >
                {children}
            </div>
        </div>
    );
};

BreadCrumb.defaultProps = {
    previousTitle: "",
    title: "",
    onPreviousTitleClick: _.noop,
    StyleOverwrite: {}
};

BreadCrumb.propTypes = {
    previousTitle: PropTypes.string,
    title: PropTypes.string,
    onPreviousTitleClick: PropTypes.func,
    helpLinkKey: PropTypes.string,
    description: PropTypes.string,
    url: PropTypes.string,
    children: PropTypes.any,
    StyleOverwrite: PropTypes.object
};

export default BreadCrumb;
