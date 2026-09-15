import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I need to update the User UI to allow editing roleKeys.
// Currently it edits role. I will add roleKeys multiselect.
const roleKeysUI = `
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Ролі (нова система)
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {roles.map((r: any) => (
                            <label key={r.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-purple-600 rounded"
                                checked={selectedUser.roleKeys?.includes(r.key) || false}
                                onChange={(e) => {
                                  const keys = selectedUser.roleKeys || [];
                                  if (e.target.checked) {
                                    setSelectedUser({...selectedUser, roleKeys: [...keys, r.key]});
                                  } else {
                                    setSelectedUser({...selectedUser, roleKeys: keys.filter((x: string) => x !== r.key)});
                                  }
                                }}
                              />
                              {r.title}
                            </label>
                          ))}
                        </div>
                      </div>
`;
content = content.replace(/<div className="mb-4">\s*<label className="block text-sm font-semibold text-slate-700 mb-1\.5">\s*Метод автентифікації/g, roleKeysUI + '\n                      <div className="mb-4">\n                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">\n                          Метод автентифікації');

fs.writeFileSync(filePath, content);
console.log('Added roleKeys UI');
