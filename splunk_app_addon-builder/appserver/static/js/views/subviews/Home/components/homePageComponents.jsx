import $ from "jquery";
import React from "react";
import _ from "lodash";

import Button from "@splunk/react-ui/Button";
import ButtonGroup from "@splunk/react-ui/ButtonGroup";
import Text from "@splunk/react-ui/Text";

import { getCustomURLPrefix } from "app/utils/AppInfo";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { tableFac } from "app/views/flux/components/tableFactory";
import { tableActionsFac } from "app/views/subviews/Home/components/tableActionFunction";
import messageDict from "app/profiles/MessageCodeDict";
import { setHomepageChoice, getHomepageChoice } from "app/utils/LocalStorageUtil";
import { setSortChoice, getSortChoice } from "app/utils/LocalStorageUtil";

import BulkDelete from "app/views/subviews/Home/components/bulkDelete.jsx";
import DropDownSort from "app/views/subviews/Home/components/dropDownSort.jsx";
import { cardViewFactory } from "app/views/subviews/Home/components/cardView.jsx";
import { tableFactory } from "app/views/components/tableComponent/tableView.jsx";
import Basic from "app/views/components/tableComponent/paginator.jsx";
import {
    CREATE_BY_BUILDER,
    INSTALLED_BY_USER,
    TABLE_MODE,
    CARD_MODE,
    DEFAULT_SORT
} from "app/views/subviews/Home/homePageConstant";
import ErrorBanner from "app/views/common/ErrorBanner.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import style from "./homePageComponents.pcssm";
import PropTypes from "prop-types";
import TabLayout from "@splunk/react-ui/TabLayout";

const { TableDataProvider: WrapperByBuilder, Props: PropsByBuilder } = tableFac();

const { TableDataProvider: WrapperInstalled, Props: PropsInstalled } = tableFac();

// pass in Label -value map
const buildByBuilderMap = [
    {
        sortKey: "name",
        label: _.t("Name")
    },
    {
        sortKey: "author",
        label: _.t("Author")
    },
    {
        sortKey: "version",
        label: _.t("Version")
    },
    {
        sortKey: "last_modified",
        label: _.t("Last Modified")
    }
];
const InstalledByUserMap = [
    {
        sortKey: "name",
        label: _.t("Name")
    },
    {
        sortKey: "author",
        label: _.t("Author")
    },
    {
        sortKey: "version",
        label: _.t("Version")
    },
    {
        sortKey: "last_modified",
        label: _.t("Last Modified")
    }
];

// passIn table action column
const tableActions = tableActionsFac(PropsByBuilder.actions);
const tableActionsInstalled = tableActionsFac(PropsInstalled.actions);

//passIn table config
const TableConfig = {
    stripeRows: true
};

const ACTION_VALIDATE = "Validate & Package";
const ACTION_EDIT = "Edit";
const ACTION_EXPORT = "Export";
const ACTION_SETTING = "Properties";
const ACTION_EXTRACTION = "Extraction";
const ACTION_CIM = "Mapping";

// create table instance
const TableViewByBuilder = tableFactory(TableConfig, buildByBuilderMap, [
    [ACTION_EDIT, tableActions.goToMainFlow],
    [ACTION_VALIDATE, tableActions.goValidation],
    [ACTION_EXPORT, _.throttle(tableActions.exportPackage, 1000)],
    [ACTION_SETTING, tableActions.modifyInline]
]);

const TableViewInstalled = tableFactory(TableConfig, InstalledByUserMap, [
    [ACTION_VALIDATE, tableActionsInstalled.goValidation],
    [ACTION_EXTRACTION, tableActionsInstalled.goExtraction],
    [ACTION_CIM, tableActionsInstalled.goCim]
]);

// create card instance
const CardByBuilder = cardViewFactory(tableActions.goToMainFlow, [
    [ACTION_VALIDATE, tableActions.goValidation],
    [ACTION_EXPORT, _.throttle(tableActions.exportPackage, 1000)],
    [ACTION_SETTING, tableActions.modifyInline]
]);

const CardInstalled = cardViewFactory(tableActionsInstalled.goToMainFlow, [
    [ACTION_VALIDATE, tableActionsInstalled.goValidation],
    [ACTION_EXTRACTION, tableActionsInstalled.goExtraction],
    [ACTION_CIM, tableActionsInstalled.goCim]
]);
class Homepage extends React.Component {
    static propTypes = {
        data: PropTypes.array
    };
    constructor(props, context) {
        super(props, context);
        this.results = this.props.data;
        this.fileUploadXhr;
        this.fileImporter;
    }
    componentWillMount() {
        this.state = _.assign(
            getHomepageChoice() || {
                showType: CREATE_BY_BUILDER,
                showMode: CARD_MODE
            }
        );
        this.resetRowsPerPage(this.state.showMode);
        this.creatByBuilder = _.remove(this.results, function(o) {
            return o.create_by_builder;
        });
        PropsByBuilder.actions.setTableData(this.creatByBuilder, buildByBuilderMap);
        PropsInstalled.actions.setTableData(this.results, InstalledByUserMap);
        this.resetSort(this.state.showType);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (_.isEqual(this.state, nextState)) {
            return false;
        } else {
            this.resetCheckbox();
            this.resetFilter();
            this.resetGeneralMessage();
            if (nextState.showType !== this.state.showType) {
                setSortChoice(DEFAULT_SORT);
            }
            this.resetSort(nextState.showType);
            return true;
        }
    }

    setShowType = (e, data) => {
        this.setState({ showType: data.activePanelId });
    };

    setShowMode = type => {
        this.resetRowsPerPage(type);
        this.setState({ showMode: type });
    };

    resetCheckbox = () => {
        if (!PropsByBuilder.getData.checkboxStatus()) {
            PropsByBuilder.actions.toggleSelectBox();
            PropsByBuilder.actions.resetDeleteCandidate();
        }
    };
    resetGeneralMessage = () => {
        PropsByBuilder.actions.setGeneralMessage("");
        PropsInstalled.actions.setGeneralMessage("");
    };
    resetRowsPerPage = type => {
        PropsByBuilder.actions.setRowsPerPage(type === TABLE_MODE ? 10 : 100000);
        PropsInstalled.actions.setRowsPerPage(type === TABLE_MODE ? 10 : 100000);
    };

    resetFilter = () => {
        PropsByBuilder.actions.searchNameAuthor("");
        PropsInstalled.actions.searchNameAuthor("");
    };

    resetSort = showType => {
        if (showType === CREATE_BY_BUILDER) {
            PropsByBuilder.actions.sortTable(..._.values(getSortChoice()));
        } else {
            PropsInstalled.actions.sortTable(..._.values(getSortChoice()));
        }
    };

    importPackage = (e, action) => {
        if (!$(this.fileImporter).val()) {
            return;
        }
        action.toggleLoadingTable(_.t("Importing add-on....."));
        function onSendDone(data) {
            $(this.fileImporter).val("");
            action.toggleLoadingTable();
            if (data.err_code) {
                PropsByBuilder.actions.setGeneralMessage(getFormattedMessage(data.err_code, data.err_args));
                return;
            }
            if (data.warn_code) {
                PropsByBuilder.actions.setGeneralMessage(getFormattedMessage(data.warn_code, data.warn_args));
            }
            PropsByBuilder.actions.addNewElem(data);
        }

        function onSendFail(response) {
            action.toggleLoadingTable();
            $(this.fileImporter).val("");
            PropsByBuilder.actions.setGeneralMessage(response.statusText);
        }

        let tarFile = e.target.files[0], uploadEndpoint = getCustomURLPrefix() + "/app_migrate/import_app";
        if (this.fileUploadXhr) {
            this.fileUploadXhr.abort();
        }
        var data = new window.FormData();
        data.append("app_package_file", tarFile);
        this.fileUploadXhr = $.ajax({
            url: uploadEndpoint,
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: onSendDone.bind(this),
            error: onSendFail.bind(this)
        });
    };
    render() {
        setHomepageChoice(this.state);
        let renderedTab = this.state.showType === CREATE_BY_BUILDER
            ? <WrapperByBuilder>
                  {() => (
                      <div>
                          <ErrorBanner
                              message={ PropsByBuilder.getData.getGeneralMessage() }
                              closeCallback={ this.resetGeneralMessage }
                          />
                          <div className={ style["buttonAndSearchGroup"] }>
                              <div className={ style["searchGroup"] }>
                                  <Text
                                      inline
                                      placeholder={ _.t("Search Add-on") }
                                      onChange={ e => PropsByBuilder.actions.searchNameAuthor(e.target.value) }
                                  />
                              </div>
                              <span className={ style["home-control-group"] }>
                                  <BulkDelete
                                      { ...PropsByBuilder }
                                      mapping={ buildByBuilderMap }
                                      checkboxStatus={ PropsByBuilder.getData.checkboxStatus() }
                                      deleteCandidate={ PropsByBuilder.getData.getDeleteCandidate() }
                                      disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                  />
                                  {" "}
                                  {PropsByBuilder.getData.checkboxStatus() &&
                                      <span>
                                          <Button
                                              onClick={ e => {
                                                  e.stopPropagation();
                                                  $(this.fileImporter)[0].click();
                                              } }
                                              disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                          >
                                              {_.t("Import Project")}
                                          </Button>
                                          <Button
                                              onClick={ tableActions.createNewAddon }
                                              appearance="primary"
                                              disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                          >
                                              {_.t("New Add-on")}
                                          </Button>
                                      </span>}
                              </span>
                          </div>
                          <TableViewByBuilder
                              { ...PropsByBuilder }
                              data={ PropsByBuilder.getData.getData() }
                              checkboxStatus={ PropsByBuilder.getData.checkboxStatus() }
                              deleteCandidate={ PropsByBuilder.getData.getDeleteCandidate() }
                              sortKey={ PropsByBuilder.getData.getSortKey() }
                              handleSortChoice={ {
                                  setSortChoice,
                                  getSortChoice
                              } }
                              isLoading={ PropsByBuilder.getData.getLoadingStatus() }
                          />
                          <div className="clearfix home-paginator">
                              <span className="paginator-right">
                                  <Basic { ...PropsByBuilder } pageInfo={ PropsByBuilder.getData.getPage() } />
                              </span>
                          </div>
                      </div>
                  )}
              </WrapperByBuilder>
            : <WrapperInstalled>
                  {() => (
                      <div>
                          <ErrorBanner
                              message={ PropsInstalled.getData.getGeneralMessage() }
                              closeCallback={ this.resetGeneralMessage }
                          />
                          <div className={ style["buttonAndSearchGroup"] }>
                              <div className={ style["searchGroup"] }>
                                  <Text
                                      inline
                                      placeholder={ _.t("Search Add-on") }
                                      onChange={ e => PropsInstalled.actions.searchNameAuthor(e.target.value) }
                                  />
                              </div>
                          </div>
                          <TableViewInstalled
                              { ...PropsInstalled }
                              data={ PropsInstalled.getData.getData() }
                              checkboxStatus={ PropsInstalled.getData.checkboxStatus() }
                              deleteCandidate={ PropsInstalled.getData.getDeleteCandidate() }
                              sortKey={ PropsInstalled.getData.getSortKey() }
                              handleSortChoice={ {
                                  setSortChoice,
                                  getSortChoice
                              } }
                              isLoading={ PropsByBuilder.getData.getLoadingStatus() }
                          />
                          <div className="clearfix home-paginator">
                              <span className="paginator-right">
                                  <Basic { ...PropsInstalled } pageInfo={ PropsInstalled.getData.getPage() } />
                              </span>
                          </div>
                      </div>
                  )}
              </WrapperInstalled>;

        let renderedCard = this.state.showType === CREATE_BY_BUILDER
            ? <WrapperByBuilder>
                  {() => (
                      <div>
                          <ErrorBanner
                              message={ PropsByBuilder.getData.getGeneralMessage() }
                              closeCallback={ this.resetGeneralMessage }
                          />
                          <div className={ style["buttonAndSearchGroup"] }>
                              <div className={ style["searchGroup"] }>
                                  <Text
                                      inline
                                      placeholder={ _.t("Search Add-on") }
                                      onChange={ e => PropsByBuilder.actions.searchNameAuthor(e.target.value) }
                                  />
                                  <DropDownSort
                                      mapping={ buildByBuilderMap }
                                      actions={ PropsByBuilder.actions }
                                      sortKey={ PropsByBuilder.getData.getSortKey() }
                                      handleSortChoice={ {
                                          setSortChoice,
                                          getSortChoice
                                      } }
                                  />
                              </div>
                              <span className={ style["home-control-group"] }>
                                  <BulkDelete
                                      { ...PropsByBuilder }
                                      mapping={ buildByBuilderMap }
                                      checkboxStatus={ PropsByBuilder.getData.checkboxStatus() }
                                      deleteCandidate={ PropsByBuilder.getData.getDeleteCandidate() }
                                      disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                  />
                                  {" "}
                                  {PropsByBuilder.getData.checkboxStatus() &&
                                      <span>
                                          <Button
                                              onClick={ e => {
                                                  e.stopPropagation();
                                                  $(this.fileImporter)[0].click();
                                              } }
                                              disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                          >
                                              {_.t("Import Project")}
                                          </Button>
                                          <Button
                                              onClick={ tableActions.createNewAddon }
                                              appearance="primary"
                                              disabled={ PropsByBuilder.getData.getLoadingStatus().status }
                                          >
                                              {_.t("New Add-on")}
                                          </Button>
                                      </span>}
                              </span>
                          </div>
                          <LoadingScreen
                              loadCondition={ PropsByBuilder.getData.getLoadingStatus().status }
                              loadingStyle={ style["loadingStyle"] }
                              loadingText={ PropsByBuilder.getData.getLoadingStatus().loadingText }
                          >
                              <CardByBuilder
                                  { ...PropsByBuilder }
                                  data={ PropsByBuilder.getData.getData() }
                                  checkboxStatus={ PropsByBuilder.getData.checkboxStatus() }
                                  deleteCandidate={ PropsByBuilder.getData.getDeleteCandidate() }
                              />
                          </LoadingScreen>
                      </div>
                  )}
              </WrapperByBuilder>
            : <WrapperInstalled>
                  {() => (
                      <div>
                          <ErrorBanner
                              message={ PropsInstalled.getData.getGeneralMessage() }
                              closeCallback={ this.resetGeneralMessage }
                          />
                          <div className={ style["buttonAndSearchGroup"] }>
                              <div className={ style["searchGroup"] }>
                                  <Text
                                      inline
                                      placeholder={ _.t("Search Add-on") }
                                      onChange={ e => PropsInstalled.actions.searchNameAuthor(e.target.value) }
                                  />
                                  <DropDownSort
                                      mapping={ InstalledByUserMap }
                                      actions={ PropsInstalled.actions }
                                      sortKey={ PropsInstalled.getData.getSortKey() }
                                      handleSortChoice={ {
                                          setSortChoice,
                                          getSortChoice
                                      } }
                                  />
                              </div>
                          </div>
                          <CardInstalled
                              { ...PropsInstalled }
                              data={ PropsInstalled.getData.getData() }
                              checkboxStatus={ PropsInstalled.getData.checkboxStatus() }
                              deleteCandidate={ PropsInstalled.getData.getDeleteCandidate() }
                          />
                      </div>
                  )}
              </WrapperInstalled>;

        return (
            <div>
                <div className="home-control-group">
                    <h3>{_.t("Add-on List")}</h3>
                    <p>{_.t(messageDict[44][0])}</p>
                    <ButtonGroup className="mode-change">
                        <Button
                            onClick={ () => this.setShowMode(CARD_MODE) }
                            selected={ this.state.showMode === CARD_MODE }
                            label={ _.t("Card View") }
                        />
                        <Button
                            onClick={ () => this.setShowMode(TABLE_MODE) }
                            selected={ this.state.showMode === TABLE_MODE }
                            label={ _.t("Table View") }
                        />
                    </ButtonGroup>
                </div>
                <TabLayout
                    style = { { marginTop: 0, borderTop: '#eee solid 20px' } }
                    activePanelId={ this.state.showType }
                    onChange={ this.setShowType }
                    >
                    <TabLayout.Panel label={ _.t("Created with Add-on Builder") } panelId={ CREATE_BY_BUILDER }>
                        {this.state.showMode === TABLE_MODE ? renderedTab : renderedCard}
                    </TabLayout.Panel>
                    <TabLayout.Panel label={ _.t("Other apps and add-ons") } panelId={ INSTALLED_BY_USER }>
                        {this.state.showMode === TABLE_MODE ? renderedTab : renderedCard}
                    </TabLayout.Panel>
                </TabLayout>
                <span
                    style={ {
                        display: "none"
                    } }
                >
                    <input
                        type="file"
                        name="app_package_file"
                        id="import-file"
                        onChange={ event =>
                            this.importPackage(
                                event,
                                this.state.showType === CREATE_BY_BUILDER
                                    ? PropsByBuilder.actions
                                    : PropsInstalled.actions
                            ) }
                        ref={ input => {
                            this.fileImporter = input;
                        } }
                    />
                </span>
            </div>
        );
    }
}

export default Homepage;
