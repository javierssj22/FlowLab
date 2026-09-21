import unittest
from unittest.mock import MagicMock
import server

class PeripheralTests(unittest.TestCase):
    def setUp(self):
        self.b=server.Bridge();self.b.connection=object();self.b.board='esp32';self.b.info={'protocol':3};self.b._request=MagicMock(return_value=100)

    def test_native_encoding(self):
        for command,args,expected in [
            ('dac',{'pin':25,'value':128},(25,128)),('touch',{'pin':4},(4,)),
            ('tone',{'pin':27,'frequency':440},(27,440)),('pcnt',{'pin':27,'gateMs':100,'filterNs':1000},(27,100,1000))]:
            self.assertEqual(self.b.command(command,args),100);self.b._request.assert_called_with(command,*expected)

    def test_invalid_requests_never_reach_serial(self):
        for command,args in [('dac',{'pin':4,'value':0}),('dac',{'pin':25,'value':256}),('tone',{'pin':27,'frequency':19}),('tone',{'pin':34,'frequency':440}),('pcnt',{'pin':27,'gateMs':1001,'filterNs':0}),('touch',{'pin':25})]:
            with self.assertRaises(ValueError):self.b.command(command,args)
        self.b._request.assert_not_called()

    def test_family_and_firmware_gates(self):
        self.b.board='esp32c3'
        with self.assertRaises(ValueError):self.b.command('pcnt',{'pin':4,'gateMs':100,'filterNs':0})
        with self.assertRaises(ValueError):self.b.command('touch',{'pin':4})
        self.b.board='esp32';self.b.info={'protocol':2}
        with self.assertRaises(ValueError):self.b.command('dac',{'pin':25,'value':0})
        self.b._request.assert_not_called()

    def test_protocol3_keeps_multibyte_and_burst(self):
        self.b.command('i2cxfer',{'address':72,'tx':[0],'readCount':2,'stop':False});self.b._request.assert_called_with('i2cxfer',72,1,2,0,0)
        self.b.command('burst',{'pin':32,'rate':20000,'count':16,'trigger':'immediate','level':2048,'pre':0,'timeout':1000})
        self.b._request.assert_called_with('burst',32,20000,16,0,2048,0,1000)
