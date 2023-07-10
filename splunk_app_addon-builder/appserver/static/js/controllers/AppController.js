import $ from "jquery";
import _ from "lodash";
import BaseController from "app/controllers/BaseController";
import WarningView from "app/views/common/WarningView";
import { getAppURLPrefix } from "app/utils/AppInfo";
import GetInputLoadStatus from "app/models/common/GetInputLoadStatus";

import MainSubView from "app/views/subviews/Summary/Master";

import DataCollectionSubView
    from "app/views/subviews/ConfigureDataInput/Master";
import DataCollectionModularInputWizard
    from "app/views/subviews/ConfigureDataInput/ModularInputWizard";

import UploadSampleSubView from "app/views/subviews/ConfigureSourcetype/Master";
import UploadSampleAddSourcetype
    from "app/views/subviews/ConfigureSourcetype/AddSourcetype";
import UploadSampleImportSourcetype
    from "app/views/subviews/ConfigureSourcetype/ImportSourcetype";
import UploadSampleEditSourcetype
    from "app/views/subviews/ConfigureSourcetype/EditSourcetype";

import CIMMappingSubView from "app/views/subviews/BuildCIMMapping/Master";
import CIMMappingAddEventType
    from "app/views/subviews/BuildCIMMapping/AddEventType";
import CIMMappingEditEventType
    from "app/views/subviews/BuildCIMMapping/EditEventType";
import CIMMappingDetail
    from "app/views/subviews/BuildCIMMapping/CIMMappingDetail";
import CIMMappingSelectCimModel
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel";

import FieldExtractionSubView
    from "app/views/subviews/BuildFieldExtraction/Master";
import FieldExtractionJsonView
    from "app/views/subviews/BuildFieldExtraction/JSONExtraction/Master";
import FieldExtractionKVView
    from "app/views/subviews/BuildFieldExtraction/KVExtraction/Master";
import FieldExtractionRegexView
    from "app/views/subviews/BuildFieldExtraction/RegexExtraction/Master";
import FieldExtractionTableView
    from "app/views/subviews/BuildFieldExtraction/TableExtraction/Master";
import FieldExtractionXMLView
    from "app/views/subviews/BuildFieldExtraction/XMLExtraction/Master";
import FieldExtractionConstant
    from "app/views/subviews/BuildFieldExtraction/Constant";

import ModularAlertSubView from "app/views/subviews/ModularAlert/Master";
import ModularAlertWizardView
    from "app/views/subviews/ModularAlert/ModularAlertWizard";

import ValidationSubView from "app/views/subviews/Validation/Master";

import { getMessageFromModel } from "app/utils/MessageUtil";

const URL_PREFIX = getAppURLPrefix() + "/tab_main_flow";

const BUILT_IN_VIEWS = {
    __default: "main",

    // view-method mapping
    "not-allowed": "_showWarning",
    main: "_showMain",
    "data-collection": "_showDataCollection",
    "upload-sample": "_showUploadSample",
    "field-extraction": "_showFieldExtraction",
    "cim-mapping": "_showCimMapping",
    "modular-alert": "_showModularAlert",
    validation: "_showValidation"
};

const BUILT_IN_NAV_ITEMS = [
    {
        value: "main",
        label: _.t("Main")
    },
    {
        value: "data-collection",
        label: _.t("Configure Data Collection")
    },
    {
        value: "upload-sample",
        label: _.t("Manage Source Types")
    },
    {
        value: "field-extraction",
        label: _.t("Extract Fields")
    },
    {
        value: "cim-mapping",
        label: _.t("Map to Data Models")
    },
    {
        value: "modular-alert",
        label: _.t("Create Alert Actions")
    },
    {
        value: "validation",
        label: _.t("Validate & Package")
    }
];

const LIMITED_VIEWS = {
    __default: "validation",

    // view-method mapping
    "cim-mapping": "_showCimMapping",
    "not-allowed": "_showWarning",
    validation: "_showValidation",
    "field-extraction": "_showFieldExtraction",
    "modular-alert": "_showModularAlert",
    "upload-sample": "_showUploadSample"
};

const LIMITED_NAV_ITEMS = [
    {
        value: "main",
        label: _.t("Main")
    },
    {
        value: "validation",
        label: _.t("Validate & Package")
    },
    {
        value: "upload-sample",
        label: _.t("Manage Source Types")
    },
    {
        value: "field-extraction",
        label: _.t("Extract Fields")
    },
    {
        value: "cim-mapping",
        label: _.t("Map to Data Models")
    },
    {
        value: "modular-alert",
        label: _.t("Create Alert Actions")
    }
];

const FIELD_EXTRACTION_VIEWS = {
    [FieldExtractionConstant.FMT_UNSTRUCTURED]: FieldExtractionRegexView,
    [FieldExtractionConstant.FMT_KV]: FieldExtractionKVView,
    [FieldExtractionConstant.FMT_JSON]: FieldExtractionJsonView,
    [FieldExtractionConstant.FMT_TABLE]: FieldExtractionTableView,
    [FieldExtractionConstant.FMT_XML]: FieldExtractionXMLView
};

export default class AppController extends BaseController {
    constructor(...params) {
        super(...params);
        this.models.inputStatusLoader = new GetInputLoadStatus();
    }
    getAppName() {
        this.models.currentTA.fetch();
        return this.models.currentTA.getAppName();
    }
    getAppDisplayName() {
        this.models.currentTA.fetch();
        return this.models.currentTA.getAppDisplayName();
    }
    isBuiltIn() {
        this.models.currentTA.fetch();
        return this.models.currentTA.isBuiltByTabuilder();
    }
    bootstrap(locale, app, page, { view, action }) {
        if (!this._bootstraped) {
            if (!this.getAppName()) {
                window.location.href = "tab_home";
                return;
            }
            this.deferreds.privilege = this.models.privilege.fetch();
            this.deferreds.inputStatusLoader = this.models.inputStatusLoader.fetch();
            this.models.navigation.on("change", this._onNavChange.bind(this));
            this._bootstraped = true;
        }
        $.when(
            this.deferreds.privilege,
            this.deferreds.inputStatusLoader
        ).done(() => {
            const replace = true;
            if (!this.models.privilege.is_allowed()) {
                this.navigate({
                    view: "not-allowed",
                    action: "",
                    replace
                });
            } else {
                let items = this._getNavItems();
                this.navigate({
                    view,
                    action,
                    replace
                });
                this._navBar.setItems(items);
            }
        });
    }
    getUrlPrefix() {
        return URL_PREFIX;
    }
    getPageName() {
        return "tab_main_flow.html";
    }
    _getNavItems() {
        let items;
        if (this.isBuiltIn()) {
            items = BUILT_IN_NAV_ITEMS;
        } else {
            items = LIMITED_NAV_ITEMS;
        }
        items[0].label = this.getAppDisplayName();
        items[0].title = this.getAppDisplayName();
        return items;
    }
    _getViews() {
        let views;
        if (this.isBuiltIn()) {
            views = BUILT_IN_VIEWS;
        } else {
            views = LIMITED_VIEWS;
        }
        return views;
    }
    _showWarning() {
        const privilege = this.models.privilege;
        this._renderView(WarningView, {
            content: getMessageFromModel(privilege)
        });
    }
    _showMain() {
        this._renderView(MainSubView);
    }
    _showDataCollection(action, params) {
        let fallback = false;
        if (action === "add") {
            this._renderView(DataCollectionModularInputWizard);
        } else if (action === "edit") {
            if (params == null) {
                fallback = true;
            } else {
                params.isEditing = true;
                this._renderView(DataCollectionModularInputWizard, params);
            }
        } else if (action === "code") {
            if (params == null) {
                fallback = true;
            } else {
                params.isEditing = true;
                params.isCoding = true;
                this._renderView(DataCollectionModularInputWizard, params);
            }
        } else {
            fallback = true;
        }
        if (fallback) {
            this._renderView(DataCollectionSubView);
        }
        return fallback;
    }
    _showUploadSample(action, params) {
        let fallback = false;
        if (action === "add") {
            this._renderView(UploadSampleAddSourcetype);
        } else if (action === "import") {
            this._renderView(UploadSampleImportSourcetype);
        } else if (action === "edit") {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(UploadSampleEditSourcetype, params);
            }
        } else {
            fallback = true;
        }
        if (fallback) {
            this._renderView(UploadSampleSubView);
        }
        return fallback;
    }
    _showFieldExtraction(action, params) {
        let fallback = false;
        if (FIELD_EXTRACTION_VIEWS.hasOwnProperty(action)) {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(FIELD_EXTRACTION_VIEWS[action], params);
            }
        } else {
            fallback = true;
        }
        if (fallback) {
            this._renderView(FieldExtractionSubView);
        }
        return fallback;
    }
    _showCimMapping(action, params) {
        let fallback = false;
        if (action === "add") {
            this._renderView(CIMMappingAddEventType);
        } else if (action === "edit") {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(CIMMappingEditEventType, params);
            }
        } else if (action === "detail") {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(CIMMappingDetail, params);
            }
        } else if (action === "selectModel") {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(CIMMappingSelectCimModel, params);
            }
        } else {
            fallback = true;
        }
        if (fallback) {
            this._renderView(CIMMappingSubView);
        }
        return fallback;
    }
    _showModularAlert(action, params) {
        let fallback = false;
        if (action === "edit" || action === "add") {
            if (params == null) {
                fallback = true;
            } else {
                this._renderView(ModularAlertWizardView, params);
            }
        } else {
            fallback = true;
        }
        if (fallback) {
            this._renderView(ModularAlertSubView);
        }
        return fallback;
    }
    _showValidation() {
        this._renderView(ValidationSubView);
    }
}
