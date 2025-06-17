using S7.Net;
using System.Text.RegularExpressions;

namespace API_ATF_MOBILE.Services
{
    public class S7CommunicationService
    {
        private readonly Plc _plc;

        public S7CommunicationService()
        {
            _plc = new Plc(CpuType.S71500, "10.250.13.10", 0, 1);
        }

        public bool Connect()
        {
            if (!_plc.IsConnected)
                _plc.Open();
            return _plc.IsConnected;
        }

        public void Disconnect()
        {
            if (_plc.IsConnected)
                _plc.Close();
        }

        public bool IsConnected => _plc.IsConnected;

        public object ReadRaw(string address)
        {
            return _plc.Read(address);
        }

        // ----------- LECTURE -----------

        public float ReadFloat(string address)
        {
            var (db, offset) = ParseAddress(address, "DBD");
            var bytes = _plc.ReadBytes(DataType.DataBlock, db, offset, 4);
            return BitConverter.ToSingle(bytes.Reverse().ToArray(), 0);
        }

        public int ReadInt32(string address)
        {
            var (db, offset) = ParseAddress(address, "DBD");
            var bytes = _plc.ReadBytes(DataType.DataBlock, db, offset, 4);
            return BitConverter.ToInt32(bytes.Reverse().ToArray(), 0);
        }

        public short ReadInt16(string address)
        {
            var (db, offset) = ParseAddress(address, "DBW");
            var bytes = _plc.ReadBytes(DataType.DataBlock, db, offset, 2);
            return BitConverter.ToInt16(bytes.Reverse().ToArray(), 0);
        }

        public byte ReadByte(string address)
        {
            var (db, offset) = ParseAddress(address, "DBB");
            var bytes = _plc.ReadBytes(DataType.DataBlock, db, offset, 1);
            return bytes[0];
        }

        public bool ReadBool(string address)
        {
            // Supporte DB2003.DBX6.2 ou DB2003.DBX6/2
            var match = Regex.Match(address, @"DB(?<db>\d+)\.DBX(?<byte>\d+)[./](?<bit>\d+)");
            if (!match.Success)
                throw new FormatException($"Adresse booléenne invalide : {address}");

            int db = int.Parse(match.Groups["db"].Value);
            int byteOffset = int.Parse(match.Groups["byte"].Value);
            int bitIndex = int.Parse(match.Groups["bit"].Value);

            var bytes = _plc.ReadBytes(DataType.DataBlock, db, byteOffset, 1);
            return (bytes[0] & (1 << bitIndex)) != 0;
        }

        // ----------- UTIL -----------

        private (int dbNumber, int byteOffset) ParseAddress(string address, string prefix)
        {
            // Ex: DB2003.DBD6 → prefix = "DBD"
            var match = Regex.Match(address, @"DB(?<db>\d+)\." + prefix + @"(?<offset>\d+)");
            if (!match.Success)
                throw new FormatException($"Adresse invalide : {address}");

            int db = int.Parse(match.Groups["db"].Value);
            int offset = int.Parse(match.Groups["offset"].Value);
            return (db, offset);
        }
    }
}
