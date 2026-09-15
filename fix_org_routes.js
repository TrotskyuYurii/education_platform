import * as fs from 'fs';

const filePath = 'server/modules/org/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix req.user by casting to any
content = content.replace(/req\.user\./g, '(req as any).user.');

// Fix deepPartial
content = content.replace(/validateRequest\(DepartmentSchema\.deepPartial\(\)\)/g, 'validateRequest(z.object({ body: DepartmentSchema.shape.body.partial() }))');
content = content.replace(/validateRequest\(PositionSchema\.deepPartial\(\)\)/g, 'validateRequest(z.object({ body: PositionSchema.shape.body.partial() }))');
content = content.replace(/validateRequest\(LocationSchema\.deepPartial\(\)\)/g, 'validateRequest(z.object({ body: LocationSchema.shape.body.partial() }))');

fs.writeFileSync(filePath, content);
console.log('Fixed org routes');
