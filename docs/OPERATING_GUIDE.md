# Operating guide

## First calibration

1. Start the hardware application and check that the ADC and reading age are updating.
2. Keep the probe fixed in representative dry soil. Wait for settled readings, describe the reference and select **Capture last 12 samples as dry**.
3. Prepare wetted soil, allow drainage and settling, and capture the wet reference in the same way.
4. Describe the calibration and activate the two references. The application requires an increasing reference gap of at least 50 ADC.
5. Enter the plant/container and soil details, choose the warning and clearing indices, confirm that you have checked them against this setup, and save.

The project experiments used dry/wet references of **0 and 636 ADC**, a dry trigger of **30**, and a clearing/quantity target of **60**. These describe that experiment. A new installation should measure its own references and check its thresholds.

The relative index is `100 * (ADC - dry) / (wet - dry)`, clipped to 0-100. Warning changes need three successive qualifying readings. Between the warning and clearing limits, the active warning state is retained.

## Build a water profile

1. Expand **Water calibration** and create a profile describing the soil amount, container/drainage, probe depth, measuring tool, graduation, maximum portion and selected check-error allowance.
2. Use fresh soil matching that profile. Select a training run, enter your initials, confirm the setup and capture the baseline **before adding water**.
3. Measure and add a portion, then save it once using the active run's addition form. Do not duplicate the same physical addition in the general watering form.
4. Wait for the three-minute soak pause. Wait longer if the reading is still changing, then capture the settled reading.
5. Repeat until the target is reached and finish the run. The supplied implementation requires a training baseline and at least three additions.
6. Repeat using fresh samples. An estimate needs at least three suitable completed training curves covering the required index increase, with acceptable agreement.

The paper's final model retained five training trials. Its selected maximum portion was 2.0 mL, graduation was 0.5 mL and check-error allowance was 2.0 mL.

The model aligns the required rise in index with each trial's own starting point. It reads water amounts between the measured points, keeps suitable trial estimates and uses their median. It retains the full water total, including early portions that produced little immediate change.

## Water a new soil sample

1. Select the intended profile with **Use profile** and confirm that the setup matches.
2. Whenever the soil sample is replaced, select **New soil sample before the first water addition**. Allow the 30-second settling period and follow the displayed status.
3. Check for fresh, settled readings and a confirmed dry warning. The quantity panel displays an estimate only when its conditions are satisfied.
4. Add the displayed next portion by hand and record the measured amount once.
5. Let the soak pause finish and inspect the soil and settled reading before continuing.
6. Stop adding water when the target is reached. If the recorded water reaches the estimate while the soil remains below target, inspect the setup and soil before any further addition.

The estimate is tied to the current sample's baseline. Recorded portions are subtracted from that sample's starting estimate. Selecting a profile alone does not reset a previous sample's water history.

## If the estimate does not appear

Read the status message above the quantity panel. Check these conditions in order:

- The Arduino is connected and readings are fresh.
- Ordinary dry/wet calibration is active and the decision thresholds are confirmed.
- The selected water profile matches the current soil, container, probe placement and active calibration.
- At least three completed training trials cover the required increase and pass the agreement check.
- The reading is settled and the soak pause has finished.
- The current sample is in a confirmed dry condition.
- **New soil sample** was selected after replacing soil and before adding water.

A low ADC value is not, by itself, a reason to discard a reading. Interpret it using the measured calibration and the system's quality checks. The quantity calculation requires covering training curves; it does not extrapolate an uncovered response.

## Separate checks and history

Use **Separate check run** with a fresh sample to compare an estimate against measurements kept outside the training set. Record each measured portion and settled capture as for a training run, then finish at the target.

Open **History & results** to inspect the response and prediction graphs. Recorded-check results retain the prediction saved for the check. Saved recalculations identify estimates calculated later from existing check measurements. The distinction matters when interpreting results.

Calendar summaries use **Africa/Johannesburg**. Water totals come from operator entries, not a flow sensor. Coverage counts eligible consecutive recorded readings. Missing sequences, long gaps and stream/calibration changes are excluded rather than filled in as continuous monitoring.

Use the dashboard's CSV/JSON links for readings, water entries, observations, events and calibration/trial evidence. Export timestamps use UTC.

## Audible warning

Select **Enable sound** in the browser tab used for monitoring. A confirmed live dry warning produces a chime, repeated every 30 seconds while active. **Silence this warning** acknowledges the current warning; a later warning can sound again. **Test sound** checks playback and **Disable sound** turns it off.

The viewing device produces the sound. Keep the dashboard open and sound allowed by the browser. The warning is quiet during soak pauses, stale/disconnected readings, sensor-check states and simulation.

## Keep the existing Pi's records

Before replacing program files, make a backup:

```bash
python3 pi/backup.py
```

The script writes a consistent SQLite snapshot and the local configuration to `pi/backups/`. It excludes the dashboard password. Keep an additional copy of the original `pi/data/` directory and `pi/config.json`; the password is in `pi/data/access_token.txt`.

Stop the running foreground app or service before replacing program files. Preserve the existing data and configuration, copy the new program files into the installation, then restart it. A new clone has no experimental database, calibration or trained water profile.

## Background operation

After testing the application in the foreground, stop it with Ctrl+C. For persistent access from another device, set `"host": "0.0.0.0"` in your local `pi/config.json`; otherwise the default configuration listens only on the Pi itself.

Install the service as your normal Pi user, from a project path without spaces:

```bash
bash pi/install_service.sh
```

The script enables and starts `comp717a-garden.service`. To inspect or restart it:

```bash
systemctl status comp717a-garden.service
journalctl -u comp717a-garden.service -n 50 --no-pager
sudo systemctl restart comp717a-garden.service
```

Avoid starting a second hardware process while the service is running. For a serial problem, close Arduino Serial Monitor, check the USB connection and inspect the service log. The default `serial_port` is `auto`; a specific device path can be set in local configuration if needed.
