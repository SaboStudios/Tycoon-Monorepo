import React from "react";

interface TradeInputs {
  offeredPropertyIds: string;
  to: string;
  tradeType: string;
  cashDirection: string;
  cashAmount: string;
}
interface OfferTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeInputs: TradeInputs;
  setTradeInputs: React.Dispatch<React.SetStateAction<TradeInputs>>;
  selectedRequestedProperties: number[];
  setSelectedRequestedProperties: React.Dispatch<
    React.SetStateAction<number[]>
  >;
  otherPlayersProperties: {
    id: number;
    name: string;
    ownerUsername: string;
    color: string;
  }[];
  handleOfferTrade: () => void;
  isLoading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const OfferTradeModal: React.FC<OfferTradeModalProps> = ({
  isOpen,
  onClose,
  tradeInputs,
  setTradeInputs,
  selectedRequestedProperties,
  setSelectedRequestedProperties,
  otherPlayersProperties,
  handleOfferTrade,
  isLoading,
  error,
  setError,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-8 rounded-[16px] w-full max-w-[360px] bg-[#0B191A]/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-white/10 overflow-y-auto max-h-[85vh]">
      <h2 className="text-xl font-semibold text-cyan-300 mb-5">Offer Trade</h2>
      {isLoading && (
        <p className="text-cyan-300 text-[13px] text-center mb-4">Loading...</p>
      )}
      {error && (
        <p className="text-red-400 text-[13px] text-center mb-4">{error}</p>
      )}
      <div className="mb-5 space-y-3">
        <input
          type="text"
          placeholder="To Player Username"
          value={tradeInputs.to}
          onChange={(e) =>
            setTradeInputs((prev) => ({ ...prev, to: e.target.value }))
          }
          className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
          aria-label="Enter recipient username"
        />
        <input
          type="text"
          placeholder="Offered Property IDs (comma-separated)"
          value={tradeInputs.offeredPropertyIds}
          onChange={(e) =>
            setTradeInputs((prev) => ({
              ...prev,
              offeredPropertyIds: e.target.value,
            }))
          }
          className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
          aria-label="Enter offered property IDs"
        />
        <div>
          <label htmlFor="" className="block text-[#F0F7F7] text-[13px] mb-1">
            Select Requested Properties
          </label>
          <div className="max-h-[150px] overflow-y-auto no-scrollbar bg-[#131F25]/80 rounded-[12px] border border-white/10 p-2">
            {otherPlayersProperties.length > 0 ? (
              otherPlayersProperties.map((property) => (
                <button
                  type="button"
                  key={property.id}
                  className={`p-2 flex items-center gap-2 cursor-pointer rounded-[8px] ${
                    selectedRequestedProperties.includes(property.id)
                      ? "bg-cyan-600/50"
                      : "hover:bg-[#1A262B]/80"
                  }`}
                  onClick={() =>
                    setSelectedRequestedProperties((prev) =>
                      prev.includes(property.id)
                        ? prev.filter((id) => id !== property.id)
                        : [...prev, property.id]
                    )
                  }
                  aria-label={`Select property ${property.name}`}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: property.color }}
                  />
                  <span className="text-[#F0F7F7] text-[12px]">
                    {property.name} (Owned by {property.ownerUsername})
                  </span>
                </button>
              ))
            ) : (
              <p className="text-[#A0B1B8] text-[12px] text-center">
                No properties available to request.
              </p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="" className="block text-[#F0F7F7] text-[13px] mb-1">
            Trade Type
          </label>
          <select
            value={tradeInputs.tradeType}
            onChange={(e) =>
              setTradeInputs((prev) => ({
                ...prev,
                tradeType: e.target.value as TradeInputs["tradeType"],
              }))
            }
            className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
            aria-label="Select trade type"
          >
            <option value="property_for_property">Property for Property</option>
            <option value="property_for_cash">Property for Cash</option>
            <option value="cash_for_property">Cash for Property</option>
          </select>
        </div>
        <div>
          <label htmlFor="" className="block text-[#F0F7F7] text-[13px] mb-1">
            Cash Amount
          </label>
          <input
            type="number"
            placeholder="Cash Amount"
            value={tradeInputs.cashAmount}
            onChange={(e) =>
              setTradeInputs((prev) => ({
                ...prev,
                cashAmount: e.target.value,
              }))
            }
            className="w-full px-4 py-2 bg-[#131F25]/80 text-[#F0F7F7] text-[13px] rounded-[12px] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300"
            aria-label="Enter cash amount"
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-[#F0F7F7] text-[13px]">
            <input
              type="radio"
              name="cashDirection"
              value="offer"
              checked={tradeInputs.cashDirection === "offer"}
              onChange={() =>
                setTradeInputs((prev) => ({ ...prev, cashDirection: "offer" }))
              }
              className="text-cyan-500 focus:ring-cyan-500"
              aria-label="Offer cash"
            />
            Offer Cash
          </label>
          <label className="flex items-center gap-2 text-[#F0F7F7] text-[13px]">
            <input
              type="radio"
              name="cashDirection"
              value="request"
              checked={tradeInputs.cashDirection === "request"}
              onChange={() =>
                setTradeInputs((prev) => ({
                  ...prev,
                  cashDirection: "request",
                }))
              }
              className="text-cyan-500 focus:ring-cyan-500"
              aria-label="Request cash"
            />
            Request Cash
          </label>
        </div>
        <button
          type="button"
          onClick={handleOfferTrade}
          aria-label="Offer a trade"
          className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-blue-700 hover:to-indigo-700 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Offer Trade
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close offer trade modal"
        className="w-full px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-[#F0F7F7] text-[13px] rounded-[12px] hover:from-gray-700 hover:to-gray-900 hover:shadow-[0_0_12px_rgba(107,114,128,0.5)] hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Close
      </button>
    </div>
  );
};

export default OfferTradeModal;
