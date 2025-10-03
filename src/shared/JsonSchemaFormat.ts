/**
 * Minimal JSON Schema format validation for LLM output format support
 */

export class JsonSchemaFormat {
    public static validateBuiltInFormat(value: string, format: string): boolean {
        let regexPattern: RegExp;

        switch (format) {
            case 'date-time':
                regexPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
                break;
            case 'date':
                regexPattern = /^\d{4}-\d{2}-\d{2}$/;
                break;
            case 'time':
                regexPattern = /^\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
                break;
            case 'email':
                regexPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                break;
            case 'hostname':
                regexPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
                break;
            case 'ipv4':
                regexPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                break;
            case 'ipv6':
                regexPattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                break;
            case 'uri':
                regexPattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
                break;
            case 'uuid':
                regexPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                break;
            default:
                return true; // Unknown format, assume valid
        }

        return regexPattern.test(value);
    }
}
