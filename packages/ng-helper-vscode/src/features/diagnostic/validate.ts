import { getNgDiagnosticResult } from '@ng-helper/shared/lib/ngDiagnostic';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, TextDocument } from 'vscode';

export function validate(diagnosticCollection: DiagnosticCollection, document: TextDocument) {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    const ngDiagnostics = getNgDiagnosticResult(text, { filePath: document.uri.toString(), version: document.version });

    for (const ngDiagnostic of ngDiagnostics) {
        diagnostics.push(
            new Diagnostic(
                new Range(document.positionAt(ngDiagnostic.start), document.positionAt(ngDiagnostic.end)),
                ngDiagnostic.message,
                DiagnosticSeverity.Error,
            ),
        );
    }

    // Set diagnostics
    diagnosticCollection.set(document.uri, diagnostics);
}
