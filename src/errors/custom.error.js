export class CustomError extends Error {
    constructor(message, statusCode = 500, details = null, type = "about:blank") {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.details = details;
        this.type = type;
    }

    serialize() {
        return {
            type: this.type,
            title: this.message,
            status: this.statusCode,
            details: this.details || undefined,
        };
    }
}