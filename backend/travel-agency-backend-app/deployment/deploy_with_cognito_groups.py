import subprocess
import sys

from deployment.provision_cognito_groups import provision_cognito_groups
from deployment.provision_travel_agent_allowlist import provision_travel_agent_allowlist


def main() -> int:
    deploy_result = subprocess.run(
        ["syndicate", "deploy", *sys.argv[1:]],
        check=False,
    )
    if deploy_result.returncode != 0:
        return deploy_result.returncode

    created_groups = provision_cognito_groups()
    if created_groups:
        print(
            "Created Cognito groups: "
            f"{', '.join(created_groups)}"
        )
    else:
        print(
            "All required Cognito groups already exist."
        )

    allowlist_result = (
        provision_travel_agent_allowlist()
    )
    print(
        "Travel Agent allowlist: "
        f"{len(allowlist_result['created'])} created, "
        f"{len(allowlist_result['existing'])} existing, "
        f"{allowlist_result['duplicateInputCount']} "
        "duplicate seed entries ignored."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
