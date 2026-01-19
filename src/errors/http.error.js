import { CustomError } from "./custom.error.js";

export class NotFoundError extends CustomError {
    constructor(resource = "Recurso") {
        super(`${resource} not found.`, 404, null, "https://mordcai.com/errors/not-found");
    }
}

export class UnauthorizedError extends CustomError {
    constructor(message = "Authentication required.") {
        super(message, 401, null, "https://mordcai.com/errors/unauthorized");
    }
}

export class ForbiddenError extends CustomError {
    constructor(message = "You are not authorized to access this resource.") {
        super(message, 403, null, "https://mordcai.com/errors/forbidden");
    }
}

export class ConflictError extends CustomError {
    constructor(message = "Conflict in the current state of the resource.") {
        super(message, 409, null, "https://mordcai.com/errors/conflict");
    }
}

export class DatabaseError extends CustomError {
    constructor(details) {
        super("Database error.", 500, details, "https://mordcai.com/errors/database");
    }
}

export class BadRequestError extends CustomError {
    constructor(message = "Bad request.") {
        super(message, 400, null, "https://mordcai.com/errors/bad-request");
    }
}