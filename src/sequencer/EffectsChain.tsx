import React from 'react';

interface Props {
    onPlay: () => void;
}

export const EffectsChain: React.FC<Props> = ({ onPlay }) => {
    const [chain, setChain] = React.useState<string[]>(['Dual 303', 'Sampler', 'Harmonizer']);
    const [active, setActive] = React.useState<boolean>(false);

    const toggle = () => setActive((a) => !a);

    return (
        <div className="effects-chain">
            <h3>Effects Chain</h3>
            <ul>
                {chain.map((fx) => (
                    <li key={fx}>{fx}</li>
                ))}
            </ul>
            <button onClick={toggle}>{active ? 'Stop' : 'Start'}</button>
            <button onClick={onPlay}>Play Note</button>
        </div>
    );
};