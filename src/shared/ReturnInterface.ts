/**
 * General Guide:
 * - 下面这些 interface, function, exported class, type 定义了你能处理的各种场景 or cases。
 * - Do not match unexported classes! They don't have $schemaId fields and are for the typing of the root schema fields.
 * - 这些场景之间没有先后关系，需要你一步一步思考，根据用户意愿匹配最合适场景，并返回相应的格式的JSON。
 * - comment 用于引导用户完完美成数据的构造.
 * - 你的回复使用严格 JSON 格式, 其格式如下(用TypeScript表示)：
 */
export class ReturnInterface {
	caseName!: string // strictly the name of the case that matches the user intention. No translation! Must be exactly one of the case interface/function/class names.
	value: any // the appropriate case object
	/**
	 * 用风趣的口吻，引导用户完成数据收集, 并且帮助提高表达的质量. 
	 * - DO NOT start with '哇', an abused word.
	 * - DO NOT use this expression pattern: '..., 请随时告诉我.'
	 */
	comment!: string
}

export type _range = [min: number, max: number]

export const pathReturnInterface = __filename // __excluded

export interface WithSchema {
	$schemaId: string
}