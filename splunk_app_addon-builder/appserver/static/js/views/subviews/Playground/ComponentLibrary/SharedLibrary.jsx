import React from "react";
import Backbone from "backbone";
import _ from "lodash";
import Styles from "./Library.pcssm";
import TitledPanel from "app/views/common/TitledPanel.jsx";
import LibraryComponentList from "./LibraryComponentList.jsx";
import Wrapper from "app/components/BackboneViewWrapper.jsx";
import CheckboxGroup from "app/components/controls/CheckboxGroup";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class SharedLibrary extends React.Component {
    static defaultProps = {
        disableLoggingCheckbox: false
    };

    static propTypes = {
        model: PropTypes.instanceOf(Backbone.Model),
        disableLoggingCheckbox: PropTypes.bool
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const options = {
            model: this.props.model,
            modelAttribute: "global_component",
            items: [
                {
                    value: "proxy_settings",
                    label: "Proxy settings"
                },
                {
                    value: "credential_settings",
                    label: "Global account settings"
                },
                {
                    value: "log_settings",
                    label: "Logging settings",
                    disabled: this.props.disableLoggingCheckbox
                }
            ]
        };
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <div style={ { height: "130px" } }>
                    <TitledPanel
                        title={ _.t("Preconfigured Parameters") }
                        className={ Styles.checkBoxGroup }
                    >
                        <Wrapper viewClass={ CheckboxGroup } options={ options } />
                    </TitledPanel>
                </div>
                <div style={ { height: "calc(100% - 130px)" } }>
                    <TitledPanel
                        title={ _.t("Component Library in Panel Setting") }
                        className={ Styles.library }
                    >
                        <LibraryComponentList { ...this.props } />
                    </TitledPanel>
                </div>
            </div>
        );
    }
}
