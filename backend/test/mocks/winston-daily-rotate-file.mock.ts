/** Minimal winston-daily-rotate-file stub for unit tests. */
const DailyRotateFile = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
}));
export default DailyRotateFile;
module.exports = DailyRotateFile;
