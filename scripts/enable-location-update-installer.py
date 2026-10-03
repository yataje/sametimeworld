from pathlib import Path
p=Path('installer/LocalSave.cs');s=p.read_text(encoding='utf8')
def replace(old,new):
 global s
 if old not in s:raise RuntimeError('Installer source anchor missing: '+old[:70])
 s=s.replace(old,new)
replace('public class PayloadManifest { public string version; public List<PayloadFile> files; }','public class PayloadManifest { public string version; public string mode; public List<PayloadFile> files; }')
replace('if(!names.Contains("sametimeworld.db") || !names.Contains("index.html"))throw new InvalidDataException("프로젝트 필수 파일이 없습니다.");', '''if(result.Manifest.mode!=null && result.Manifest.mode!="location_update")throw new InvalidDataException("지원하지 않는 저장 모드입니다.");
            bool update=result.Manifest.mode=="location_update";
            if(!names.Contains("index.html") || (!update&&!names.Contains("sametimeworld.db")) || (update&&(!names.Contains("data/location/location-update.json.gz")||!names.Contains("tools/LocationDBUpdate.exe")||names.Contains("sametimeworld.db"))))throw new InvalidDataException("프로젝트 필수 파일이 없습니다.");''')
replace('public static class Installer {', '''public static class LocationUpdate {
    public static void Apply(string stage) {
        string input=Path.Combine(stage,"sametimeworld.db"),output=Path.Combine(stage,"sametimeworld.location-new.db");
        if(!File.Exists(input)||File.Exists(output))throw new IOException("기존 통합 DB가 없거나 이전 작업 파일이 남아 있습니다. 기존 파일은 변경하지 않습니다.");
        string helper=Path.Combine(stage,"tools", "LocationDBUpdate.exe"),patch=Path.Combine(stage,"data","location","location-update.json.gz");
        var start=new System.Diagnostics.ProcessStartInfo(helper, "\\\""+input+"\\\" \\\""+output+"\\\" \\\""+patch+"\\\"") { UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=stage,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8 };
        using(var proc=System.Diagnostics.Process.Start(start)) {
            var stdout=proc.StandardOutput.ReadToEndAsync();var stderr=proc.StandardError.ReadToEndAsync();
            if(!proc.WaitForExit(180000)){try{proc.Kill();}catch{}throw new IOException("위치 DB 검사 시간이 초과되었습니다. 기존 폴더는 변경하지 않습니다.");}
            string message=stderr.Result,report=stdout.Result;
            if(proc.ExitCode!=0||!File.Exists(output))throw new IOException("위치 DB 갱신을 중단했습니다: "+message);
            File.WriteAllText(Path.Combine(stage,".stw-location-update.json"),report,new UTF8Encoding(false));
        }
        File.SetAttributes(input,FileAttributes.Normal);File.Delete(input);File.Move(output,input);
    }
}
public static class Installer {''')
replace('string target=ValidateTarget(requested),parent=Path.GetDirectoryName(target),leaf=Path.GetFileName(target);Directory.CreateDirectory(parent);', 'string target=ValidateTarget(requested),parent=Path.GetDirectoryName(target),leaf=Path.GetFileName(target);if(package.Manifest.mode=="location_update"&&!File.Exists(Path.Combine(target,"sametimeworld.db")))throw new IOException("이번 파일은 기존 통합 DB를 보존하는 업데이트용입니다. v0.8.0 자료가 저장된 프로젝트 폴더를 선택하세요.");Directory.CreateDirectory(parent);')
replace('original.CopyTo(stage);package.Extract(stage,progress);','original.CopyTo(stage);package.Extract(stage,progress);\n                    if(package.Manifest.mode=="location_update"){progress("복사본에서 위치 DB를 갱신하고 기존 사건·출처를 대조합니다.");LocationUpdate.Apply(stage);}')
replace('Text="SameTimeWorld 로컬 저장 · 0.7.0"','Text="SameTimeWorld 로컬 저장 · 0.8.1"')
replace('기존 폴더 전체 백업 → 새 버전 저장','기존 폴더 전체 백업 → 위치정보 업데이트')
replace('인터넷 연결·별도 설치가 필요 없습니다.', '기존 통합 DB가 있는 프로젝트에 적용합니다. 인터넷·별도 설치는 필요 없습니다.')
p.write_text(s,encoding='utf8')
# PyInstaller's console encoding must be deterministic when started by the GUI saver.
p=Path('scripts/apply-location-update.py');s=p.read_text();s=s.replace("if __name__=='__main__':\n try:main()", "if __name__=='__main__':\n if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf8')\n if hasattr(sys.stderr,'reconfigure'):sys.stderr.reconfigure(encoding='utf8')\n try:main()");p.write_text(s,encoding='utf8')
