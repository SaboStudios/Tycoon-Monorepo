import React from 'react'

const WhatIsTycoon = () => {
    return (
        <section className="w-full lg:h-[400px] md:h-[300px] h-[400px] relative px-4">
            <div className="w-full max-w-[1200px] min-w-[300px] mx-auto">
                <svg
                    viewBox="0 0 1200 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-auto"
                >
                    <path
                        d="M8 366.914H252.097C256.515 366.914 260.097 370.496 260.097 374.914V394C260.097 398.418 263.678 402 268.097 402H347.816C349.938 402 351.974 401.157 353.474 399.656L403.308 305.602C404.808 304.101 406.843 303.258 408.966 303.258H897.337C901.756 303.258 905.337 306.84 905.337 311.258V394C905.337 398.418 908.919 402 913.337 402H1130.64C1132.76 402 1134.79 401.157 1136.29 399.656L1186.13 305.602C1187.63 304.101 1189.66 303.258 1191.79 303.258H1260C1264.42 303.258 1268 299.676 1268 295.258V5C1268 2.16344 1264.42 0 1260 0H57.3345C55.2122 0 53.1768 0.84331 51.6764 2.34431L3.34198 100.398C1.8424 101.898 1 103.933 1 106.054V366.914C1 371.332 4.58173 374.914 8 374.914Z"
                        stroke="url(#paint0_linear_333_835)"
                    />
                    <defs>
                        <linearGradient id="paint0_linear_333_835" x1="600" y1="0" x2="600" y2="400" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#0FF0FC" />
                            <stop offset="0.259609" stopColor="#0FF0FC" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            <main className="w-full h-full absolute top-0 left-0 flex flex-col justify-center items-center">
                <div className='lg:w-[80%] md:w-[70%] w-[80%] flex lg:flex-row items-center flex-col gap-4'>
                    <h1 className="flex-1 text-[#F0F7F7] font-orbitron lg:text-[64px] text-[42px] leading-[42px] lg:leading-[64px] font-[700]">What is Tycoon</h1>
                    <p className="flex-1 font-dmSans font-[400] text-[18px] text-[#F0F7F7] -tracking-[2%]">Tycoon is a fun digital board game where you collect tokens, trade with others, and complete challenges to win, all powered by blockchain.</p>
                </div>
            </main>
        </section>
    )
}

export default WhatIsTycoon