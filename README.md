# S3 Manta Bridge

This project allows you to use the S3 API to perform operations against a Manta 
object store. It is a purely open source community maintained project.

The S3Manta Bridge doesn't attempt to emulate all of the functionality of S3.
Rather, it emulates a subset of functionality that is sufficient for migrating
existing applications to using the Manta object store.

## Docker

If you would like to just run the bridge, please refer to the 
[Docker configuration documentation](docs/docker.md). This is the best way to
get a server up and running quickly on the Joyent public cloud.

## Contributions

Contributions welcome! Please read the [contributing document](CONTRIBUTING.md) for 
details on getting started.

### Testing

When running the unit tests, you will need an active account on the Joyent 
public cloud or a private Manta instance.

### Bugs

See <https://github.com/dekobon/s3-manta-bridge/issues>.

## License

The S3 Manta Bridge is licensed under the MPLv2. Please see the 
[LICENSE.txt](LICENSE.txt) file for more details. 
