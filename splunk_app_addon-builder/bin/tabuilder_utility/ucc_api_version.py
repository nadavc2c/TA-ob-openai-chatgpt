class APIVersion:
    EXPECTED_VERSION_SIZE = 3

    def __init__(self, api_version):
        self.api_version = api_version
        [major_version, minor_version, build_version] = APIVersion.extract_data_from(
            self.api_version
        )
        self.major_version = major_version
        self.minor_version = minor_version
        self.build_version = build_version

    def major(self):
        return self.major_version

    def minor(self):
        return self.minor_version

    def build(self):
        return self.build_version

    @staticmethod
    def extract_data_from(data):
        if not data:
            return [None for i in range(APIVersion.EXPECTED_VERSION_SIZE)]

        values = [version for version in data.split(".")]
        while len(values) < APIVersion.EXPECTED_VERSION_SIZE:
            values.append(None)
        return values[0 : APIVersion.EXPECTED_VERSION_SIZE]
