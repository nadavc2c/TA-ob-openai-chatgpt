import _ from "lodash";

const UNSTRUCTURED = "unstructured_data",
    KV = "kv",
    FMT_JSON = "json",
    TABLE = "tabular",
    XML = "xml",
    UNPARSED = "Unparsed_ Data";

const FMT2LABEL = {
    [UNSTRUCTURED]: _.t("Unstructured Data"),
    [KV]: _.t("Key Value"),
    [FMT_JSON]: _.t("JSON"),
    [TABLE]: _.t("Table"),
    [XML]: _.t("XML"),
    [UNPARSED]: _.t("(Unparsed Data)")
};

const CONF_TYPE = {
    PROPS: "props",
    TRANSFORMS: "transforms"
};

export default {
    FMT_UNSTRUCTURED: UNSTRUCTURED,
    FMT_KV: KV,
    FMT_JSON: FMT_JSON,
    FMT_TABLE: TABLE,
    FMT_XML: XML,
    FMT_UNPARSED: UNPARSED,
    FMT2LABEL: FMT2LABEL,
    LABEL_UNSTRUCTURED: FMT2LABEL[UNSTRUCTURED],
    LABEL_KV: FMT2LABEL[KV],
    LABEL_JSON: FMT2LABEL[FMT_JSON],
    LABEL_TABLE: FMT2LABEL[TABLE],
    LABEL_XML: FMT2LABEL[XML],
    LABEL_UNPARSED: FMT2LABEL[UNPARSED],
    CONF_TYPE
};
