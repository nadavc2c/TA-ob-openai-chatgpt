import BaseInputPropertiesComponent from "./BaseInputPropertiesComponent.jsx";

export default class CustomizedInputPropertiesComponent
    extends BaseInputPropertiesComponent {
    static defaultProps = BaseInputPropertiesComponent.defaultProps;

    static propTypes = BaseInputPropertiesComponent.propTypes;

    constructor(...args) {
        super(...args);
    }
    formatLocalCustomizeSettingsTooltip() {
        return "";
    }
}
