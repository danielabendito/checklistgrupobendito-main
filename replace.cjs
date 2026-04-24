const fs = require('fs');
let content = fs.readFileSync('src/pages/Checklist.tsx', 'utf8');
const startMatch = '<main className="container mx-auto px-4 py-8">';
const endMatch = '</main>';

const startIdx = content.indexOf(startMatch);
if (startIdx === -1) {
  console.log('startMatch not found');
  process.exit(1);
}

const afterStart = content.substring(startIdx + startMatch.length);
const endIdxLocal = afterStart.lastIndexOf(endMatch);

if (endIdxLocal === -1) {
  console.log('endMatch not found');
  process.exit(1);
}

const endIdx = startIdx + startMatch.length + endIdxLocal;

const newMain = `      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {items.length > 0 && currentItemIndex < items.length && (() => {
          const item = items[currentItemIndex];
          const response = responses[item.id];
          const status = response?.status || 'pendente';

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground px-2">
                <span>Passo {currentItemIndex + 1} de {items.length}</span>
              </div>

              <Card className={\`transition-all duration-300 border-2 \${status === 'ok' ? 'border-success bg-success/5 shadow-success/10 shadow-lg' : status === 'nok' ? 'border-destructive bg-destructive/5 shadow-destructive/10 shadow-lg' : 'border-primary/20 shadow-lg'}\`}>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {item.ordem}
                      </div>
                      <CardTitle className="text-xl leading-tight">{item.nome}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={status === 'ok' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(item.id, 'ok')}
                      className={\`h-16 text-lg font-bold transition-all duration-200 rounded-xl \${status === 'ok' ? 'bg-success hover:bg-success/90 text-white shadow-xl shadow-success/20 ring-2 ring-success ring-offset-2' : 'hover:bg-success/10 hover:text-success border-2 hover:border-success/50'}\`}
                    >
                      <CheckCircle2 className="h-6 w-6 mr-2" />
                      SIM
                    </Button>
                    <Button
                      variant={status === 'nok' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(item.id, 'nok')}
                      className={\`h-16 text-lg font-bold transition-all duration-200 rounded-xl \${status === 'nok' ? 'bg-destructive hover:bg-destructive/90 text-white shadow-xl shadow-destructive/20 ring-2 ring-destructive ring-offset-2' : 'hover:bg-destructive/10 hover:text-destructive border-2 hover:border-destructive/50'}\`}
                    >
                      <XCircle className="h-6 w-6 mr-2" />
                      NÃO
                    </Button>
                  </div>

                  {(item.requer_observacao || status === 'nok') && (
                    <div className="space-y-3 pt-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Observações
                        {item.observacao_obrigatoria && <span className="text-destructive">*</span>}
                      </label>
                      <Textarea
                        placeholder={
                          item.observacao_obrigatoria 
                            ? 'Campo obrigatório - descreva a situação detalhadamente...' 
                            : 'Adicione observações adicionais se necessário...'
                        }
                        value={response?.observacoes || ''}
                        onChange={(e) => handleObservacaoChange(item.id, e.target.value)}
                        className="min-h-[100px] resize-none text-base p-4 rounded-xl"
                        maxLength={2000}
                        required={item.observacao_obrigatoria}
                      />
                    </div>
                  )}

                  {item.requer_foto && (
                    <div className="space-y-3 pt-2 border-t mt-4">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Foto de Evidência Obrigatória <span className="text-destructive">*</span>
                      </Label>
                      {signedPhotoUrls[item.id] ? (
                        <div className="relative group rounded-xl overflow-hidden shadow-md">
                          <img 
                            src={signedPhotoUrls[item.id]} 
                            alt="Evidência" 
                            className="w-full h-56 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              variant="destructive"
                              className="rounded-full shadow-lg"
                              onClick={() => handleRemovePhoto(item.id)}
                            >
                              <X className="h-4 w-4 mr-2" /> Remover Foto
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CameraCapture
                            open={cameraOpenFor === item.id}
                            onClose={() => setCameraOpenFor(null)}
                            onCapture={(file) => {
                              saveProgressToSession();
                              handlePhotoUpload(item.id, file);
                            }}
                            disabled={uploadingPhoto === item.id}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full h-16 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 rounded-xl text-base"
                            onClick={() => setCameraOpenFor(item.id)}
                            disabled={uploadingPhoto === item.id}
                          >
                            {uploadingPhoto === item.id ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Camera className="h-5 w-5 mr-2" />
                                Tirar Foto
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="w-1/3 h-14 text-base rounded-xl"
                  onClick={() => setCurrentItemIndex(prev => prev - 1)}
                  disabled={currentItemIndex === 0}
                >
                  Anterior
                </Button>
                
                {currentItemIndex === items.length - 1 ? (
                  <Button 
                    size="lg"
                    className="flex-1 h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    onClick={handleSave}
                    disabled={saving || inspecting || !canSave}
                  >
                    {saving || inspecting ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5 mr-2" />
                    )}
                    Concluir
                  </Button>
                ) : (
                  <Button 
                    size="lg"
                    variant="secondary"
                    className="flex-1 h-14 text-base font-bold rounded-xl"
                    onClick={() => setCurrentItemIndex(prev => prev + 1)}
                  >
                    Próximo
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </main>`;

const final = content.substring(0, startIdx) + newMain + content.substring(endIdx + endMatch.length);
fs.writeFileSync('src/pages/Checklist.tsx', final);
console.log('SUCCESS');
