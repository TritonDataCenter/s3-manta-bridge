# S3 Manta Bridge

This project allows you to use the S3 API to perform operations against a Manta 
object store. It is a purely open source community maintained project and
not officially supported by Joyent.

The S3 Manta Bridge doesn't attempt to emulate all of the functionality of S3.
Rather, it emulates a subset of functionality that is sufficient for migrating
existing applications to using the Manta object store.

If an operation is not supported, *please* file an issue and if you can create
a PR supporting the operation.

## Overview

Buckets map to subdirectories within an arbitrary directory on the the Manta 
object store. This directory is set in the configuration via `bucketPath`
parameter. All bucket operations will happen within that high-level directory 
and objects will be storied in the respective subdirectories.

All operations on objects are streamed between the bridge and the Manta object
store. Very little is kept in memory.

Authentication is done using the AWS v2 or v4 signature methods. Currently, the
bridge only supports a single access / secret key pair. This key pair is set
in the configuration file.

### DNS

S3 identifies buckets using subdomains. This adds some complexity to emulating
the S3 API. Thus, you will need to setup a wildcard subdomain and a root domain 
to map to the address in which the bridge is running. If you want SSL/TLS 
support, you will need a certification that supports wildcard subdomains.

You can run the Bridge without subdomain support, but it will be in a 
configuration that not many clients will support.

### Docker

If you would like to just run the bridge, please refer to the 
[Docker configuration documentation](docs/docker.md). This is the best way to
get a server up and running quickly on the Joyent public cloud.

### Getting Started

You will need at least Node JS 4.4.7 to run the S3 Manta Bridge.

1. Install dependencies: `npm install`
2. Configure by editing `./etc/config.json`
3. Run: `node ./app.js` or `LOG_LEVEL=debug node ./app.js | bunyan` for debug mode.

### Configuration

The configuration file is located at `./etc/config.json`. All values can have
environment variables interpolated in them using the format: `$XXXXX`.

| Field                           | Description                                                                   | Default            |
|---------------------------------|-------------------------------------------------------------------------------|--------------------|
| authEnabled                     | Flag indicating if authentication is enabled                                  | true               |
| baseHostname                    | Root hostname that subdomains are prefixed to                                 |                    |
| stripBucketPathFromAuth         | Flag indicating if we drop the bucket path from path used for auth signing    | false              |
| prettyPrint                     | Flag indicating to send output in a human-friendly manner                     | false              |
| bucketPath                      | Path to directory in Manta containing buckets                                 | ~~/stor/s3_buckets |
| baseSubdomain                   | Subdomain to assume if there is none specified                                | s3                 |
| maxRequestBodySize              | Maximum size of a request that will be accepted                               | 1073741824         |
| s3Version                       | Version of S3 API to report                                                   | 2006-03-01         |
| accessKey                       | Access key to use for authenication                                           |                    |
| secretKey                       | Secret key to use for authentication                                          |                    |
| maxAllowedSkewMilliseconds      | Maximum number of milliseconds of clock skew to allow for when authenticating | 900000             |
| defaultDurability               | Default number of copies of an object to store in Manta                       | 2                  |
| maxFilenameLength               | Maximum number of characters to allow in a filename                           | 1024               |
| storageClassMappingToDurability | Associative array mapping S3 storage class to Manta durability                |                    |
| durabilityMappingToStorageClass | Associative array mapping Manta durability to S3 storeace class               |                    |
| manta                           | Associative array of Manta settings                                           |                    |

### Contributions

Contributions welcome! Please read the [contributing document](CONTRIBUTING.md) for 
details on getting started.

#### Testing

When running the unit tests, you will need an active account on the Joyent 
public cloud or a private Manta instance.

#### Bugs

See <https://github.com/joyent/s3-manta-bridge/issues>.

#### License

The S3 Manta Bridge is licensed under the MPLv2. Please see the 
[LICENSE.txt](LICENSE.txt) file for more details. 
