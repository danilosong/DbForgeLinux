# Synthetic Access fixture

`app/test/fixtures/sample-access.mdb` is synthetic project data created by
`GenerateAccessFixture.java`; it contains no third-party or personal data.

Regenerate it with JDK 21 and Python 3:

```sh
tools/access-fixture/generate.sh
```

The generator downloads exact Maven Central versions into a temporary directory,
checks each artifact against the SHA-1 checksum published beside it, compiles
with `javac --release 21`, writes the fixture, and removes the downloaded JARs.
Pinned coordinates:

| Artifact | Version | Published SHA-1 |
| --- | --- | --- |
| `com.healthmarketscience.jackcess:jackcess` | `4.0.7` | `6f76d90e920f14f6a2787483063d09e5c58d8e8c` |
| `org.apache.commons:commons-lang3` | `3.10` | `e155460aaf5b464062a09c3923f089ce99128a17` |
| `commons-logging:commons-logging` | `1.2` | `4bfc12adfe4842bf07b657f0369c4cb522955686` |

Jackcess 4.0.7 was published in June 2024, over 14 days before this fixture
was added. Jackcess is Apache-2.0 licensed. The generated file contains three
tables (`Customers`, `Orders`, and `Tags`) with primary keys; text with
Portuguese accents and apostrophes; integers; currency; date/time; booleans;
long memo text; and NULL fields.
