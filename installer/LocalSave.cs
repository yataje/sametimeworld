// Offline project saver. No network, registry, scheduled tasks or browser launch.
// Build with the Windows .NET Framework compiler; payload is appended after compilation.
using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;
using System.Threading.Tasks;
using System.Reflection;

public class PayloadFile { public string path; public string sha256; public long size; }
public class PayloadManifest { public string version; public List<PayloadFile> files; }
public sealed class Payload : IDisposable {
    public PayloadManifest Manifest;
    private MemoryStream stream;
    private ZipArchive zip;
    public static string Hex(byte[] b) { return BitConverter.ToString(b).Replace("-", "").ToLowerInvariant(); }
    public static string Digest(Stream s) { using (var h=SHA256.Create()) return Hex(h.ComputeHash(s)); }
    public static string SafeRelative(string s) {
        if (String.IsNullOrWhiteSpace(s) || s.Contains("\\") || s.Contains(":") || s.StartsWith("/")) throw new InvalidDataException("잘못된 저장 경로");
        foreach (var p in s.Split('/')) {
            if (p=="" || p=="." || p==".." || p.EndsWith(".") || p.EndsWith(" ") || p.IndexOfAny(Path.GetInvalidFileNameChars())>=0 || Regex.IsMatch(p,@"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$",RegexOptions.IgnoreCase)) throw new InvalidDataException("안전하지 않은 파일명");
        }
        return s;
    }
    public static Payload Open(string exe) {
        byte[] body;
        using (var f=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read)) using(var br=new BinaryReader(f)) {
            if(f.Length<48)throw new InvalidDataException("저장 자료가 없습니다.");
            f.Position=f.Length-48;long n=br.ReadInt64();byte[] expected=br.ReadBytes(32);string magic=Encoding.ASCII.GetString(br.ReadBytes(8));
            if(magic!="STWPKG01" || n<1 || n>512L*1024*1024 || n>f.Length-48)throw new InvalidDataException("저장 파일 형식이 올바르지 않습니다.");
            f.Position=f.Length-48-n;body=br.ReadBytes((int)n);
            using(var h=SHA256.Create())if(!h.ComputeHash(body).SequenceEqual(expected))throw new InvalidDataException("저장 자료가 손상되었습니다. 기존 폴더는 변경하지 않습니다.");
        }
        var result=new Payload();
        try {
            result.stream=new MemoryStream(body,false);result.zip=new ZipArchive(result.stream,ZipArchiveMode.Read);
            var entry=result.zip.GetEntry("_stw_manifest.json");if(entry==null || entry.Length>10*1024*1024)throw new InvalidDataException("검증 목록이 없습니다.");
            using(var sr=new StreamReader(entry.Open(),Encoding.UTF8))result.Manifest=new JavaScriptSerializer { MaxJsonLength=12*1024*1024 }.Deserialize<PayloadManifest>(sr.ReadToEnd());
            if(result.Manifest==null || result.Manifest.files==null || result.Manifest.files.Count==0 || result.Manifest.files.Count>50000)throw new InvalidDataException("빈 저장 자료입니다.");
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long total=0;
            foreach(var row in result.Manifest.files) {
                SafeRelative(row.path);if(!names.Add(row.path) || row.path=="_stw_manifest.json" || row.size<0 || row.size>512L*1024*1024 || !Regex.IsMatch(row.sha256??"",@"^[a-f0-9]{64}$"))throw new InvalidDataException("중복되거나 잘못된 검증 항목입니다.");
                total+=row.size;if(total>2L*1024*1024*1024)throw new InvalidDataException("저장 자료가 너무 큽니다.");
                var ze=result.zip.GetEntry(row.path);if(ze==null || ze.Length!=row.size || ((ze.ExternalAttributes>>16)&0xF000)==0xA000)throw new InvalidDataException("누락되거나 잘못된 파일입니다: "+row.path);
                using(var s=ze.Open())if(Digest(s)!=row.sha256)throw new InvalidDataException("내용 검증 실패: "+row.path);
            }
            var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach(var ze in result.zip.Entries){SafeRelative(ze.FullName);if(!seen.Add(ze.FullName) || (ze.FullName!="_stw_manifest.json"&&!names.Contains(ze.FullName)))throw new InvalidDataException("검증 목록 밖의 파일이 있습니다.");}
            if(!names.Contains("sametimeworld.db") || !names.Contains("index.html"))throw new InvalidDataException("프로젝트 필수 파일이 없습니다.");
            return result;
        } catch { result.Dispose();throw; }
    }
    public void Extract(string root,Action<string> progress) {
        foreach(var row in Manifest.files) {
            string p=Path.Combine(root,row.path.Replace('/',Path.DirectorySeparatorChar));Directory.CreateDirectory(Path.GetDirectoryName(p));
            if(File.Exists(p)){File.SetAttributes(p,FileAttributes.Normal);File.Delete(p);}
            using(var s=zip.GetEntry(row.path).Open())using(var d=new FileStream(p,FileMode.CreateNew,FileAccess.Write,FileShare.None))s.CopyTo(d);
            using(var f=File.OpenRead(p))if(f.Length!=row.size||Digest(f)!=row.sha256)throw new IOException("저장 후 검증 실패: "+row.path);
        }
        progress("새 파일 검증 완료");
    }
    public void Dispose(){if(zip!=null)zip.Dispose();if(stream!=null)stream.Dispose();}
}
public sealed class Snapshot : IDisposable {
    public class Item { public string relative;public long size;public string sha256;public FileStream handle;public DateTime writeTime;public FileAttributes attributes; }
    public List<Item> Files=new List<Item>();public List<string> Dirs=new List<string>();
    public static void NoLink(string p){if((File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw new IOException("바로가기·연결 폴더는 자동 저장 대상에서 제외할 수 없습니다. 연결을 해제하거나 별도 폴더를 선택하세요: "+p);}
    private void ReadDir(string root,string dir) {
        NoLink(dir);foreach(string child in Directory.GetFileSystemEntries(dir)){
            NoLink(child);string rel=child.Substring(root.Length).TrimStart(Path.DirectorySeparatorChar);var attr=File.GetAttributes(child);
            if((attr&FileAttributes.Directory)!=0){Dirs.Add(rel);ReadDir(root,child);continue;}
            var f=new FileStream(child,FileMode.Open,FileAccess.Read,FileShare.Read|FileShare.Delete);
            try {if((child.EndsWith("-wal",StringComparison.OrdinalIgnoreCase)||child.EndsWith("-journal",StringComparison.OrdinalIgnoreCase))&&f.Length>0)throw new IOException("사용 중인 DB 기록 파일이 있습니다. DB 편집기·업데이터를 종료한 뒤 다시 실행하세요.");
                var item=new Item { relative=rel,size=f.Length,sha256=Payload.Digest(f),handle=f,writeTime=File.GetLastWriteTimeUtc(child),attributes=attr };f.Position=0;Files.Add(item);
            }catch{f.Dispose();throw;}
        }
    }
    public static Snapshot Read(string root){var s=new Snapshot();try{if(Directory.Exists(root))s.ReadDir(root,root);return s;}catch{s.Dispose();throw;}}
    public void CopyTo(string stage){foreach(string d in Dirs)Directory.CreateDirectory(Path.Combine(stage,d));foreach(var item in Files){string p=Path.Combine(stage,item.relative);Directory.CreateDirectory(Path.GetDirectoryName(p));item.handle.Position=0;using(var f=new FileStream(p,FileMode.CreateNew,FileAccess.Write,FileShare.None))item.handle.CopyTo(f);using(var f=File.OpenRead(p))if(Payload.Digest(f)!=item.sha256)throw new IOException("기존 파일 복사 검증 실패: "+item.relative);File.SetLastWriteTimeUtc(p,item.writeTime);File.SetAttributes(p,item.attributes);}}
    public void VerifyInventory(string root){if(!Directory.Exists(root)){if(Files.Count>0)throw new IOException("기존 폴더가 변경되었습니다.");return;}var all=Directory.GetFiles(root,"*",SearchOption.AllDirectories);if(all.Length!=Files.Count)throw new IOException("저장 도중 파일이 추가 또는 삭제되었습니다. 프로그램을 닫고 재시도하세요.");foreach(var item in Files){string p=Path.Combine(root,item.relative);if(!File.Exists(p)||File.GetLastWriteTimeUtc(p)!=item.writeTime)throw new IOException("저장 도중 기존 파일이 변경되었습니다.");}}
    public void VerifyMatches(Snapshot other){
        if(!new HashSet<string>(Dirs,StringComparer.OrdinalIgnoreCase).SetEquals(other.Dirs))throw new IOException("백업 직전에 폴더가 변경되었습니다.");
        var map=other.Files.ToDictionary(f=>f.relative,StringComparer.OrdinalIgnoreCase);
        if(map.Count!=Files.Count)throw new IOException("백업 직전에 파일 수가 변경되었습니다.");
        foreach(var f in Files){Item actual;if(!map.TryGetValue(f.relative,out actual)||actual.size!=f.size||actual.sha256!=f.sha256)throw new IOException("백업 내용이 원래 검사한 자료와 다릅니다: "+f.relative);}
    }
    public void Dispose(){foreach(var f in Files){if(f.handle!=null){f.handle.Dispose();f.handle=null;}}}
}
public static class Installer {
    static string Full(string p){return Path.GetFullPath(p).TrimEnd(Path.DirectorySeparatorChar);}
    public static string ValidateTarget(string requested) {
        if(!Path.IsPathRooted(requested)||requested.StartsWith(@"\\"))throw new IOException("이 컴퓨터의 로컬 폴더를 선택하세요.");
        string target=Full(requested),root=Path.GetPathRoot(target);
        if(target.Length<=root.Length)throw new IOException("드라이브 전체에는 저장할 수 없습니다.");
        var reserved=new[]{Environment.GetFolderPath(Environment.SpecialFolder.Windows),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),Environment.GetFolderPath(Environment.SpecialFolder.Desktop),Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)};
        foreach(string p in reserved)if(!String.IsNullOrEmpty(p)&&(target.Equals(Full(p),StringComparison.OrdinalIgnoreCase)||(p==Environment.GetFolderPath(Environment.SpecialFolder.Windows)&&target.StartsWith(Full(p)+"\\",StringComparison.OrdinalIgnoreCase))))throw new IOException("시스템·개인 문서 폴더 대신 프로젝트 전용 폴더를 선택하세요.");
        for(string p=target;!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p)){if(Directory.Exists(p))Snapshot.NoLink(p);}
        string own=Assembly.GetExecutingAssembly().Location;if(own.StartsWith(target+"\\",StringComparison.OrdinalIgnoreCase))throw new IOException("이 EXE를 다운로드 폴더 등 저장 대상 밖으로 옮겨 실행하세요.");
        if(Directory.Exists(target)&&Directory.GetFileSystemEntries(target).Length>0&&!File.Exists(Path.Combine(target,"sametimeworld.db"))&&!File.Exists(Path.Combine(target,".stw-install.json"))) {
            bool project=false;string pkg=Path.Combine(target,"package.json");if(File.Exists(pkg)){try{var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(pkg));project=d.ContainsKey("name")&&Convert.ToString(d["name"])=="sametimeworld";}catch{}}
            if(!project)throw new IOException("SameTimeWorld 프로젝트인지 확인되지 않는 폴더입니다. 기존 자료를 보호하기 위해 중단합니다.");
        }
        return target;
    }
    public static string Install(Payload package,string requested,Action<string> progress) {
        string target=ValidateTarget(requested),parent=Path.GetDirectoryName(target),leaf=Path.GetFileName(target);Directory.CreateDirectory(parent);
        string lockPath=Path.Combine(parent,"."+leaf+".stw-install.lock");
        using(var guard=new FileStream(lockPath,FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None)) {
            string token=DateTime.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,8);
            string stage=Path.Combine(parent,"."+leaf+".stw-stage-"+token),backupRoot=Path.Combine(parent,"SameTimeWorld_Backups"),backup=Path.Combine(backupRoot,leaf+"-"+token);bool moved=false,installed=false;string receipt;
            try {
                progress("기존 폴더의 모든 파일을 검사합니다. 사용 중인 파일은 덮어쓰지 않습니다.");
                using(var original=Snapshot.Read(target)){
                    long need=original.Files.Sum(f=>f.size)+package.Manifest.files.Sum(f=>f.size)+64L*1024*1024;
                    if(new DriveInfo(Path.GetPathRoot(target)).AvailableFreeSpace<need)throw new IOException("백업·검증용 디스크 공간이 부족합니다.");
                    Directory.CreateDirectory(stage);progress("기존 파일을 보존한 새 폴더를 준비합니다.");original.CopyTo(stage);package.Extract(stage,progress);
                    original.VerifyInventory(target);
                    if(Directory.Exists(backupRoot))Snapshot.NoLink(backupRoot);Directory.CreateDirectory(backupRoot);
                    receipt=new JavaScriptSerializer { MaxJsonLength=32*1024*1024 }.Serialize(new { version=package.Manifest.version,installed_at=DateTime.Now.ToString("o"),target=target,backup=Directory.Exists(target)?backup:null,original_files=original.Files.Select(f=>new{path=f.relative,sha256=f.sha256,size=f.size}).ToArray(),payload_files=package.Manifest.files });
                    string receiptPath=Path.Combine(stage,".stw-install.json");if(File.Exists(receiptPath))File.SetAttributes(receiptPath,FileAttributes.Normal);File.WriteAllText(receiptPath,receipt,new UTF8Encoding(false));
                    progress("기존 폴더 전체를 날짜별 백업으로 보존합니다.");
                    // NTFS refuses directory renames while descendant file handles remain open.
                    // Release only after staging is verified, then re-lock and compare the renamed backup.
                    original.Dispose();
                    if(Directory.Exists(target)){Directory.Move(target,backup);moved=true;}
                    try{
                        using(var checkedBackup=Snapshot.Read(moved?backup:target)){
                            original.VerifyMatches(checkedBackup);
                            Directory.Move(stage,target);installed=true;
                        }
                    }catch{if(moved&&!Directory.Exists(target)){Directory.Move(backup,target);moved=false;}throw;}
                }
                // Receipt failure must not invalidate a completed, already verified folder switch.
                try{File.WriteAllText(backup+".receipt.json",receipt,new UTF8Encoding(false));}catch{}
                progress("저장이 완료되었습니다. 기존 백업은 자동 삭제하지 않습니다.");return moved?backup:"기존 폴더 없음 · 새로 저장";
            }catch{
                if(moved&&!installed&&!Directory.Exists(target)&&Directory.Exists(backup)){Directory.Move(backup,target);moved=false;}
                throw;
            }finally{
                if(Directory.Exists(stage)){try{foreach(var p in Directory.GetFiles(stage,"*",SearchOption.AllDirectories))File.SetAttributes(p,FileAttributes.Normal);Directory.Delete(stage,true);}catch{}}
            }
        }
    }
}
public sealed class SaveForm : Form {
    TextBox destination=new TextBox(),status=new TextBox();Button save=new Button(),browse=new Button();bool busy;
    public SaveForm(){
        Text="SameTimeWorld 로컬 저장 · 0.7.0";ClientSize=new Size(680,365);MinimumSize=new Size(690,395);StartPosition=FormStartPosition.CenterScreen;Font=new Font("Malgun Gothic",10);BackColor=Color.FromArgb(16,25,36);ForeColor=Color.FromArgb(231,241,249);
        var heading=new Label {Text="기존 폴더 전체 백업 → 새 버전 저장",Location=new Point(24,22),Size=new Size(620,30),Font=new Font(Font,FontStyle.Bold)};
        var info=new Label {Text="DB·페이지·사용자 파일을 먼저 보존합니다. 백업 실패 시 적용하지 않습니다.\n프로젝트에서 실행 중인 DB 편집기·서버·업데이터는 먼저 종료하세요.",Location=new Point(24,59),Size=new Size(620,52)};
        destination.Text=@"C:\sametimeworld";destination.SetBounds(24,124,510,30);browse.Text="폴더 선택";browse.SetBounds(545,122,110,34);browse.Click+=(s,e)=>{using(var d=new FolderBrowserDialog()){d.Description="SameTimeWorld 전용 저장 폴더";if(Directory.Exists(destination.Text))d.SelectedPath=destination.Text;if(d.ShowDialog()==DialogResult.OK)destination.Text=d.SelectedPath;}};
        status.Multiline=true;status.ReadOnly=true;status.BackColor=BackColor;status.ForeColor=ForeColor;status.BorderStyle=BorderStyle.FixedSingle;status.SetBounds(24,170,631,115);status.Text="인터넷 연결·별도 설치가 필요 없습니다.\r\n백업은 저장 폴더 옆 SameTimeWorld_Backups에 날짜별로 남습니다.\r\n브라우저나 페이지는 자동 실행하지 않습니다.";
        save.Text="백업 후 저장";save.SetBounds(450,304,205,38);save.Click+=async(s,e)=>{if(busy)return;try{Installer.ValidateTarget(destination.Text);}catch(Exception ex){MessageBox.Show(this,ex.Message,"저장 경로 확인",MessageBoxButtons.OK,MessageBoxIcon.Warning);return;}if(MessageBox.Show(this,destination.Text+"\n\n기존 폴더 전체를 백업한 후 새 버전을 저장합니다. 진행할까요?","백업 후 저장",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;busy=true;save.Enabled=browse.Enabled=destination.Enabled=false;string target=destination.Text;try{string backup=await Task.Run(()=>{using(var p=Payload.Open(Assembly.GetExecutingAssembly().Location))return Installer.Install(p,target,msg=>BeginInvoke((Action)(()=>status.Text=msg)));});status.Text="저장 완료: "+target+"\r\n백업: "+backup+"\r\n기존 사용자 파일과 이전 백업을 보존했습니다.";}catch(Exception ex){status.Text="저장 실패: "+ex.Message+"\r\n실패 시 기존 폴더를 유지하거나 되돌립니다. 남겨진 백업을 삭제하지 마세요.";}finally{busy=false;save.Enabled=browse.Enabled=destination.Enabled=true;}};
        FormClosing+=(s,e)=>{if(busy){e.Cancel=true;MessageBox.Show(this,"파일 검증·저장 중에는 창을 닫을 수 없습니다.");}};
        Controls.AddRange(new Control[]{heading,info,destination,browse,status,save});
    }
}
public static class Program {
    [STAThread] public static int Main(string[] args){
        if(args.Length>0){try{using(var p=Payload.Open(Assembly.GetExecutingAssembly().Location)){if(args[0]=="/verify")return 0;if(args.Length==2&&args[0]=="/install"){Installer.Install(p,args[1],s=>{});return 0;}}return 2;}catch(Exception e){Console.Error.WriteLine(e.ToString());return 1;}}
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new SaveForm());return 0;
    }
}
