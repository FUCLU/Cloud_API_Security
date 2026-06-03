"""DPoP nonce/JTI reuse smoke test.

This project primarily prevents replay by storing DPoP `jti` values in Redis
with SET NX semantics. The full end-to-end attack is implemented in
`replay_dpop_attack.py`; this lightweight entrypoint exists so README commands
do not point to an empty file.
"""

from pathlib import Path


def main() -> None:
    replay_script = Path(__file__).with_name("replay_dpop_attack.py")
    print("Nonce/JTI reuse is validated by:", replay_script)
    print("Run: python scripts/attacks/replay_dpop_attack.py")


if __name__ == "__main__":
    main()
