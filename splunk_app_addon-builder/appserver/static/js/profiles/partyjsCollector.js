import Collector from "ui-metrics-collector";

const HELPLINK_ID = "app.add-on.builder.partyjs";
const API_KEY = "794d65f6";
Collector.checkAgreement({ learnMoreLink: HELPLINK_ID });
Collector.start({ apiKey: API_KEY });
Collector.HELPLINK_ID = HELPLINK_ID;

export default Collector;
