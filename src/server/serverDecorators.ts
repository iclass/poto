
import "reflect-metadata";


const ROLES_KEY = Symbol('roles');

/**
 * the values of the decorator should match those of {@link PotoUser}
 * 
 * @example
 * class Foo {
    @roles('role1', 'role2')
    myMethod() {
        console.log("Executing myMethod...");
    }

    @roles('role3')
    anotherMethod() {
        console.log("Executing anotherMethod...");
    }

    noRolesMethod() {
        console.log("Executing noRolesMethod...");
    }
}
 * @param allowedRoles 
 * @returns 
 */
export function roles(...allowedRoles: string[]) {
    return function (target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor): any {
        // Store the allowed roles as metadata on the method
        Reflect.defineMetadata(ROLES_KEY, allowedRoles, target, propertyKey);
        return descriptor;
    } as any;
}

// Helper function to get all methods and their required roles
export function getAllMethodsAndRoles(target: any): Record<string, string[]> {
    const methodRoles: Record<string, string[]> = {};
	// console.debug({target})
    const methodNames = Object.getOwnPropertyNames(target.prototype).filter(
        (name) => typeof target.prototype[name] === 'function' && name !== 'constructor'
    );

    for (const methodName of methodNames) {
        const roles = Reflect.getMetadata(ROLES_KEY, target.prototype, methodName);
        methodRoles[methodName] = roles || []; // If no roles are defined, assign an empty array
    }

    return methodRoles;
}
