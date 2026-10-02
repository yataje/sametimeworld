import ast,pathlib,subprocess,unittest
class BrowserExpressionTests(unittest.TestCase):
 def test_embedded_javascript_has_valid_syntax(self):
  tree=ast.parse((pathlib.Path(__file__).parent/'browser-smoke.py').read_text())
  for node in ast.walk(tree):
   if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr in ('evaluate','wait_for_function') and node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str):
    r=subprocess.run(['node','--check','--input-type=module'],input='('+node.args[0].value+');',text=True,capture_output=True)
    self.assertEqual(r.returncode,0,r.stderr)
if __name__=='__main__':unittest.main()
