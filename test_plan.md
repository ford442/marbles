1. **Draft new zone**: Append `createCloudCityZone` function to `src/zone_draft.js`. This will serve as our new 3D zone draft.
2. **Expose the zone**: Import `createCloudCityZone` in `src/main.js` and integrate it into the level builder under a new `case 'cloud_city':`.
3. **Create playable level**: Add a `cloud_city_run` level to `src/levels.js` that uses the new zone to verify it works.
4. **Verification**: Run syntax checks and the build process to verify the integration.
5. **Pre-commit**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
6. **Submit**: Finalize the implementation and submit the task.
