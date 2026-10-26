[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$ErrorActionPreference = 'Stop'
try {
  $job = [Console]::In.ReadToEnd() | ConvertFrom-Json
  Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class MinduRawPrinter {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public class DocInfo { [MarshalAs(UnmanagedType.LPWStr)] public string Name="Mindu receipt"; [MarshalAs(UnmanagedType.LPWStr)] public string Output=null; [MarshalAs(UnmanagedType.LPWStr)] public string Type="RAW"; }
 [DllImport("winspool.drv",EntryPoint="OpenPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
 [DllImport("winspool.drv",EntryPoint="StartDocPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern int StartDocPrinter(IntPtr handle,int level,[In] DocInfo doc);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool WritePrinter(IntPtr handle,byte[] bytes,int count,out int written);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool AbortPrinter(IntPtr handle);
 [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr handle);
 static void Check(bool ok){if(!ok)throw new Win32Exception(Marshal.GetLastWin32Error());}
 public static void Send(string printer,byte[] data){
  IntPtr handle;Check(OpenPrinter(printer,out handle,IntPtr.Zero));bool started=false;
  try {Check(StartDocPrinter(handle,1,new DocInfo())>0);started=true;Check(StartPagePrinter(handle));
   int offset=0;
   while(offset<data.Length){int count=Math.Min(32768,data.Length-offset);byte[] chunk=new byte[count];Array.Copy(data,offset,chunk,0,count);int written;Check(WritePrinter(handle,chunk,count,out written));if(written<=0||written>count)throw new Exception("Incomplete printer write");offset+=written;}
   Check(EndPagePrinter(handle));Check(EndDocPrinter(handle));started=false;
  } finally {if(started)AbortPrinter(handle);ClosePrinter(handle);}
 }
}
"@
  $bytes = [Convert]::FromBase64String($job.data)
  if ($bytes.Length -gt 4194304) { throw 'Receipt too large' }
  [MinduRawPrinter]::Send([string]$job.printer, $bytes)
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
