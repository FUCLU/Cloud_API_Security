"""Evaluation C2: DPoP replay/nonce uniqueness.

This wrapper documents the evidence path for nonce/JTI replay. The executable
end-to-end attack is `scripts/attacks/replay_dpop_attack.py`.
"""


def main() -> None:
    print("E-C2 checks DPoP replay protection through Redis SET NX on jti.")
    print("Run: python scripts/attacks/replay_dpop_attack.py")
    print("Expected result: first proof accepted, replayed proof rejected.")


if __name__ == "__main__":
    main()
