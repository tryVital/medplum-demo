<h1 align="center">Medplum: Vital Demo</h1>

This project integrates Vital with Medplum, providing seamless interoperability between the two platforms. Vital is a powerful tool for managing healthcare data, and by integrating it with Medplum, we enhance Medplum�s capabilities for handling vital orders, lab results, and other critical health metrics.

## Setup and Configuration

### Prerequisites

- Ensure you have a Medplum and Vital account.
- Obtain your [Vital API credentials](https://docs.tryvital.io/home/quickstart#1-api-keys).

### Step-by-Step Guide

1. **Install the Vital Bots**

   - First, you need to install the [Vital bots](https://github.com/medplum/medplum/tree/main/examples/medplum-demo-bots/src/vital).
   - Once created, you need to get the unique ID for the [vital bot](https://github.com/medplum/medplum/blob/main/examples/medplum-demo-bots/src/vital/vital.ts) and use it as the `VITAL_BOT_IDENTIFIER` in the next step.

1. **Add Secrets to Your Medplum Project**
   - Navigate to your Medplum project settings.
   - Go to the **Secrets** section and add the following secrets:
     - `VITAL_API_KEY`: Your Vital API key.
     - `VITAL_BASE_URL`: The base URL for the Vital API.
     - `VITAL_BOT_IDENTIFIER`: The bot identifier obtained from the bot creation step.

## Contribution

We welcome contributions to improve this integration. If you encounter any issues or have suggestions, feel free to open an issue or submit a pull request.

## Additional Resources

- [Medplum Documentation](https://www.medplum.com/docs)
- [Vital API Documentation](https://docs.tryvital.io/home/welcome)
