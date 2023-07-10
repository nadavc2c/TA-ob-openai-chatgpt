import _ from 'lodash';
const dict = {
    step_sourcetype: {
        description: `
        If your add-on uses data from a source other than a modular input,
        you can create a new source type or import one from Splunk.
        <ul><li>To create a new source type, click <b>Add</b> and then <b>New Source Type</b>.</li>
        <li>To use an existing source type from Splunk platform, click <b>Add</b> and then <b>Import from Splunk</b>.</li></ul>
        If you want to edit the existing source type, configure the timestamp or event line breaking,
        click <b>Edit</b> of the source types listed below.
        `,
        key: "step_sourcetype"
    },
    step_sourcetype_add: {
        description: `
        Enter a name for the source type, then click <b>Upload Data</b> to add the sample data.
        You can also select options for event breaking and advanced parsing settings,
        which will be applied to the sample data you upload for this source type.
        `,
        key: "step_sourcetype"
    },
    step_sourcetype_import: {
        description: `
        Select a source type you want to import from the drop-down list. You can also add
        sample data to your input, but it is optional. You can also select options for
        event breaking and advanced parsing settings, which will be applied to the sample
        data you upload for this source type.
        `,
        key: "step_sourcetype"
    },
    step_sourcetype_edit: {
        description: `
        Click <b>Upload Data</b> to add more sample data to this source type.
        You can also select options for event breaking and advanced parsing settings,
        which will be applied to the sample data you upload.
        `,
        key: "step_sourcetype"
    },
    step_datainput: {
        description: `
        Create and configure the data inputs for your add-on to collect and
        get data into Splunk Enterprise.
        `,
        key: "step_datainput"
    },
    step_datainput_choose_method: {
        description: `
        Select the method below that matches how you will get data.
        `,
        key: "step_datainput"
    },
    step_datainput_basic_setting: {
        description: `
        Enter the properties for your data input, including the name
        of the source type to create for it.
        `,
        key: "step_datainput"
    },

    step_datainput_customized_input: {
        description: `
        Fill out the form below to define your data input, enter variables to pass
        to the script, then click <b>Test</b> to preview the results.
        `,
        key: "step_datainput"
    },
    step_datainput_command_input: {
        description: `
        Fill out the form below to define your data input, enter variables to pass
        to the script, then click <b>Test</b> to preview the results.
        `,
        key: "step_datainput"
    },
    step_datainput_rest_input: {
        description: `
        Fill out the form below to define your data input, enter variables to pass
        to the script, then click <b>Test</b> to preview the results.
        `,
        key: "step_datainput"
    },
    step_datasetup: {
        description: `
        Build the setup for your add-on.
        `,
        key: "step_datasetup"
    },
    step_fieldextraction: {
        description: `
        Splunk Add-on Builder provides you three ways to build the field extractions.<br/>
        <ul><li><b>Assisted Extraction.</b> Splunk Add-on Builder will detect the format of the
        data and provide you the recommended regex  to parse your data.</li></ul>
        <span>If you have complex field extractions or field transformations in the existing
        add-ons which cannot be supported by Splunk Add-on Builder, you can also</span>
        <ul><li><b>Manual Extraction.</b> Configure the field extraction manually in Splunk platform.</li>
        <li><b>Manual Transformation.</b> Configure the field transformation manually in Splunk platform.</li>
        </li></ul>
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_parse: {
        description: `
        Please select one format you want for your data.
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_regex: {
        description: `
        The summary below shows how your sample data was parsed for the Unstructured Data format.
        Select the relevant patterns for the fields you want to extract. Select <b>Show the regular expression</b>
        to fine tune the field extraction.<br>
        When the results look correct, click  <b>Save</b>. Otherwise, click <b>Cancel</b> to return to the
        previous page to try parsing the data using a different format.
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_table: {
        description: `
        The summary below shows how your sample data was parsed for the Table format. Select the column delimiter
        character, or click <b>Other</b> to enter a different one.<br>When the results look correct, click
        <b>Save</b>. Otherwise, click <b>Cancel</b> to return to the previous page to try parsing the data using a different format.
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_kv: {
        description: `
        The summary below shows how your sample data was parsed for the Key Value format.
        <ul><li>Under <b>Pair Delimiter</b>, select the character used to separate key-value pairs.</li>
        <li>Under <b>Key Value</b>, select the character used to separate keys and values.</li>
        <li>Click <b>Other</b> to enter a different delimiter character.</li></ul>
        When the results look correct, click <b>Save</b>. Otherwise, click <b>Cancel</b> to return
        to the previous page to try parsing the data using a different format.
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_json: {
        description: `
        The summary below shows how your sample data was parsed for the JSON format. If the results look correct, click
        <b>Save</b>. Otherwise, click <b>Cancel</b> to return to the previous page to try parsing the data using a different format.
        `,
        key: "step_fieldextraction"
    },
    step_fieldextraction_xml: {
        description: `
        The summary below shows how your sample data was parsed for the XML format. If the results look correct, click
        <b>Save</b>. Otherwise, click <b>Cancel</b> to return to the previous page to try parsing the data using a different format.
        `,
        key: "step_fieldextraction"
    },
    step_mapcim: {
        description: `
        Map fields from your add-on to Data Models. Click <b>New Data Model Mapping</b> to define an event type,
        then map fields from your events to Data Model Fields.<br>
        To map events from existing source types created outside of this add-on in Splunk platform (for example, data from HTTP Event Collector and syslogs),
        go to <b>Manage Source Types</b> first to add the data to your add-on.
        `,
        key: "step_mapcim"
    },
    step_mapcim_addevent: {
        description: `
        Define an event type with a search to generate results, then preview the output of the search.
        You can apply additional search criteria as needed.
        When the results look correct, click <b>Save</b> to continue.
        `,
        key: "step_mapcim_addevent"
    },
    step_mapcim_detail: {
        description: `
        The Data Model Mapping List shows all the mappings for the source types in the current event type.<br>
        Starting by selecting the data models and datasets you want to use, then click <b>New Knowledge Object</b>
        to map event type fields to Data Model Fields or expressions.<br><br>
        <b>Tip</b> Click a field name from the lists on either side to use it in the current mapping.
        `,
        key: "step_mapcim_detail"
    },
    step_mapcim_addmodel: {
        description: `
        From the center panel, select one or more data models to use for mapping.
        You can select an entire model or individual datasets within it.<br/>
        For reference, your event type fields and selected Data Model Fields are also listed.
        `,
        key: "step_mapcim_addmodel"
    },
    step_summary: {
        description: `
        Welcome to the home page for your add-on project!<br>
        Start with the options below to begin adding components to your add-on.
        The summary shows your progress.
        `,
        key: "step_summary"
    },
    step_alert: {
        description: `
        The summary below shows the alert actions for your add-on. Click <b>New Alert Action</b> to create one.
        `,
        key: "step_alert"
    },
    step_alert_basic_setting: {
        description: `
        Enter the properties for this alert action, and choose whether
        to use the Adaptive Response feature of Splunk Enterprise Security.
        `,
        key: "step_alert"
    },
    step_alert_action_definition: {
        description: `
        Define the alert action and the setup form by editing the code, enter variables to pass to the script,
        then click Test to run the scripts to verify they work as expected. Click < to go back and edit the inputs as needed.
        `,
        key: "step_alert"
    },
    step_validate: {
        description: `
        Click <b>Validate</b> to validate your add-on against best practices and other rules, and to determine
        whether your app is ready for Splunk App Certification.<br>
        When you have finished creating your add-on, click <b>Download Package</b> to create and download the SPL package file.
        `,
        key: "step_validate"
    },
    home_configuration: {
        description: `
        Enter the login settings for your Splunk.com account. This information is required for the app precertification process.
        `,
        key: "home_configuration"
    }
};

export default dict;
