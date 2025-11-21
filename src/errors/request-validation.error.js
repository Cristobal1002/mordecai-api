import { CustomError } from "./custom.error.js";

export class RequestValidationError extends CustomError {
    constructor(errors) {
        super(
            "Validation error",
            400,
            errors,
            "https://mordcai.com/docs/errors/validation-error"
        );

        this.errors = errors;
    }

    serialize() {
        return {
            type: this.type,
            title: "The data sent is not valid",
            status: this.statusCode,
            invalidParams: this.errors.map((x) => ({
                field: x.param,
                message: x.msg,
                location: x.location,
                value: x.value
            })),
        };
    }
}