import React from "react";
import _ from "lodash";
import Styles from "./Library.pcssm";
import TitledPanel from "app/views/common/TitledPanel.jsx";
import LibraryComponentList from "./LibraryComponentList.jsx";
import { createTestHook } from "app/utils/testSupport";

export default class Library extends React.Component {
    constructor(...args) {
        super(...args);
    }
    render() {
        let title = _.t("Component Library");
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <TitledPanel title={ title }>
                    <LibraryComponentList { ...this.props } />
                </TitledPanel>
            </div>
        );
    }
}
