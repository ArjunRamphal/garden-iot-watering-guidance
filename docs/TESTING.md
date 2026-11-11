# Software verification

## Checks completed for the repository preparation

Verified on 11 November 2026 in an isolated Linux environment, using Python 3.12 and the versions in `requirements.txt`.

| Check | Result |
| --- | --- |
| Existing Python unittest suite | 22 tests passed |
| Existing JavaScript dry-warning checks | 10 controller checks passed; Node reports one successful test file |
| Bash syntax for the three Pi scripts | Passed |
| Comparison with the updated submission ZIP | Arduino/Pi program files are byte-for-byte unchanged |

The Python tests exercise frame validation, calibration/index handling, warning confirmation and hysteresis, stale/disconnected readings, restart behaviour, water-entry validation, CSV handling, authentication and CSRF, fragmented serial frames, graph payloads and calendar summaries.

The sound checks exercise opt-in playback, repeats, silence, soak/quality suppression, stale data, simulation, watchdog expiry, new streams and audio failure.

These are software checks. No connected Pi, Uno, probe or physical watering trial was used during this repository preparation. The Arduino sketch was preserved from the submission package; it was not compiled or flashed here. The existing suites do not establish general prediction accuracy across soils.

## Run on the Pi

After `bash pi/setup_pi.sh`, run from the project root:

```bash
python3 -m unittest discover -s tests -v
```

If Node.js is available, also run:

```bash
node --test tests/test_dry_warning.js
```

Node is needed for the sound-controller tests, not for the Pi dashboard server.

## Isolated developer environment

On Linux with Python's venv support, from the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
node --test tests/test_dry_warning.js
```

The dependency pins record the direct packages tested during repository preparation. The Pi setup script uses Raspberry Pi OS packages through apt. Its `start.sh` deliberately invokes `/usr/bin/python3`.

For a software-only preview inside the activated developer environment:

```bash
python pi/app.py --simulate
```

The preview writes labelled simulated data to `pi/data/demo.sqlite3`, separate from hardware records. A new preview contains no measured training trials.

